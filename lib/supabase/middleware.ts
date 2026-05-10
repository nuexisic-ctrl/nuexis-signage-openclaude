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

    // 2. Cross-tenant check — check cache first to avoid DB load
    const cachedCookie = request.cookies.get('cached_team_slug')?.value
    let cachedTeamSlug: string | undefined
    
    if (cachedCookie && cachedCookie.startsWith(`${user.id}:`)) {
      cachedTeamSlug = cachedCookie.substring(user.id.length + 1)
    }

    if (cachedTeamSlug) {
      if (cachedTeamSlug === teamSlug) {
        return supabaseResponse
      } else {
        const correctDashboard = request.nextUrl.clone()
        correctDashboard.pathname = `/customer/${cachedTeamSlug}/dashboard`
        return NextResponse.redirect(correctDashboard)
      }
    }

    // Cache miss — read from JWT claims instead of hitting the DB
    const dbTeamSlug = (user.app_metadata?.team_slug || user.user_metadata?.team_slug) as string | undefined

    if (!dbTeamSlug) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }

    if (dbTeamSlug !== teamSlug) {
      const correctDashboard = request.nextUrl.clone()
      correctDashboard.pathname = `/customer/${dbTeamSlug}/dashboard`
      const response = NextResponse.redirect(correctDashboard)
      response.cookies.set('cached_team_slug', `${user.id}:${dbTeamSlug}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
      return response
    } else {
      supabaseResponse.cookies.set('cached_team_slug', `${user.id}:${dbTeamSlug}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    }
  }

  // 3. Auth pages — redirect logged-in users to their dashboard
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    (teamSlug && pathname === `/customer/${teamSlug}/login`)

  if (isAuthPage && user) {
    const cachedCookie = request.cookies.get('cached_team_slug')?.value
    let userTeamSlug: string | undefined
    
    if (cachedCookie && cachedCookie.startsWith(`${user.id}:`)) {
      userTeamSlug = cachedCookie.substring(user.id.length + 1)
    }

    if (!userTeamSlug) {
      userTeamSlug = (user.app_metadata?.team_slug || user.user_metadata?.team_slug) as string | undefined
    }

    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = userTeamSlug
      ? `/customer/${userTeamSlug}/dashboard`
      : '/'
      
    const response = NextResponse.redirect(dashboardUrl)
    if (userTeamSlug) {
      response.cookies.set('cached_team_slug', `${user.id}:${userTeamSlug}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    }
    return response
  }

  return supabaseResponse
}
