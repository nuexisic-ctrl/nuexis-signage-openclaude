import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — important: do NOT add logic between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ─── Auth Guard Rules ──────────────────────────────────────────────────────

  // Extract team_slug from /customer/[team_slug]/...
  const customerMatch = pathname.match(/^\/customer\/([^/]+)/)
  const teamSlug = customerMatch?.[1]

  // Protected routes — all non-login routes under /customer/[team_slug]/
  const isProtectedRoute =
    teamSlug &&
    !pathname.endsWith('/login') &&
    pathname.startsWith(`/customer/${teamSlug}/`)

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
          maxAge: 60 * 60 * 24 * 7 
        })
      }
    }

    if (!userTeamSlug) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }

    if (userTeamSlug !== teamSlug) {
      const correctDashboard = request.nextUrl.clone()
      correctDashboard.pathname = `/customer/${userTeamSlug}/dashboard`
      return NextResponse.redirect(correctDashboard)
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
        maxAge: 60 * 60 * 24 * 7 
      })
    }
    return response
  }

  return supabaseResponse
}
