import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { resilientFetch } from './resilientFetch'

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  // Prevent header spoofing by deleting any client-provided x-user headers
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-email')
  requestHeaders.delete('x-user-metadata')
  requestHeaders.delete('x-user-app-metadata')

  const { pathname } = request.nextUrl

  // Check if this is a Next.js prefetch request
  const isPrefetch =
    request.headers.get('x-middleware-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'

  const hasAuthCookie = request.cookies.getAll().some(cookie =>
    cookie.name.includes('auth-token')
  )

  // Extract team_slug from /customer/[team_slug]/...
  const customerMatch = pathname.match(/^\/customer\/([^/]+)/)
  const teamSlug = customerMatch?.[1]

  // Protected routes — all non-login routes under /customer/[team_slug]/
  const isProtectedRoute =
    teamSlug &&
    !pathname.endsWith('/login') &&
    pathname.startsWith(`/customer/${teamSlug}/`)

  // If it's a prefetch request, bypass getUser() API call if they have an auth cookie
  if (isPrefetch) {
    if (isProtectedRoute && !hasAuthCookie) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = `/customer/${teamSlug}/login`
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: resilientFetch,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — important: do NOT add logic between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // Propagate user metadata securely through request headers to Server Components
  // to avoid redundant auth.getUser() calls in layouts and pages
  if (user) {
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-email', user.email || '')
    requestHeaders.set('x-user-metadata', JSON.stringify(user.user_metadata || {}))
    requestHeaders.set('x-user-app-metadata', JSON.stringify(user.app_metadata || {}))
  }

  // ─── Auth Guard Rules ──────────────────────────────────────────────────────


  // 1. Require authentication on protected routes
  if (isProtectedRoute) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = `/customer/${teamSlug}/login`
      return NextResponse.redirect(loginUrl)
    }

    // 2. Cross-tenant check
    let userTeamSlug = user.app_metadata?.team_slug as string | undefined

    // Fallback: If JWT doesn't have team_slug (e.g. users created before the update)
    if (!userTeamSlug) {
      // Check cache first
      const cachedCookie = request.cookies.get('cached_team_slug')?.value
      if (cachedCookie && cachedCookie.startsWith(`${user.id}:`)) {
        userTeamSlug = cachedCookie.substring(user.id.length + 1)
      }

      if (!userTeamSlug) {
        // Fetch securely from DB
        const { data: profile } = await supabase
          .from('profiles')
          .select('teams(slug)')
          .eq('id', user.id)
          .single()
        
        userTeamSlug = profile?.teams && !Array.isArray(profile.teams) 
          ? profile.teams.slug 
          : undefined
      }

      // If we found it, cache it in a cookie
      if (userTeamSlug) {
        supabaseResponse.cookies.set('cached_team_slug', `${user.id}:${userTeamSlug}`, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production', 
          sameSite: 'lax', 
          maxAge: 60 * 60 // 1 hour
        })
      }
    }

    if (!userTeamSlug) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }

    if (userTeamSlug !== teamSlug) {
      return NextResponse.rewrite(new URL('/404', request.url))
    }
  }

  // 3. Auth pages — redirect logged-in users to their dashboard
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    (teamSlug && pathname === `/customer/${teamSlug}/login`)

  if (isAuthPage && user) {
    let userTeamSlug = user.app_metadata?.team_slug as string | undefined

    if (!userTeamSlug) {
      const cachedCookie = request.cookies.get('cached_team_slug')?.value
      if (cachedCookie && cachedCookie.startsWith(`${user.id}:`)) {
        userTeamSlug = cachedCookie.substring(user.id.length + 1)
      }

      if (!userTeamSlug) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('teams(slug)')
          .eq('id', user.id)
          .single()
        
        userTeamSlug = profile?.teams && !Array.isArray(profile.teams) 
          ? profile.teams.slug 
          : undefined
      }
    }

    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = userTeamSlug
      ? `/customer/${userTeamSlug}/dashboard`
      : '/'
      
    const response = NextResponse.redirect(dashboardUrl)
    if (userTeamSlug && !user.app_metadata?.team_slug) {
      response.cookies.set('cached_team_slug', `${user.id}:${userTeamSlug}`, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax', 
        maxAge: 60 * 60 // 1 hour
      })
    }
    return response
  }

  // Ensure the request headers are forwarded in the response
  const finalResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  supabaseResponse.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      maxAge: cookie.maxAge,
      expires: cookie.expires
    })
  })
  
  return finalResponse
}
