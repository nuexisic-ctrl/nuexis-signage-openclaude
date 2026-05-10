import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
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

    // 2. Cross-tenant check — verify team membership against the DB (source of truth)
    //    instead of trusting user_metadata which can be modified client-side.
    const { data: membership } = await supabase
      .from('profiles')
      .select('team_id, teams!inner(slug)')
      .eq('id', user.id)
      .single()

    if (!membership) {
      // User has no profile/team — redirect to home
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbTeamSlug = (membership as any).teams?.slug as string | undefined

    if (dbTeamSlug && dbTeamSlug !== teamSlug) {
      // User is trying to access a team they don't belong to — redirect to their real dashboard
      const correctDashboard = request.nextUrl.clone()
      correctDashboard.pathname = `/customer/${dbTeamSlug}/dashboard`
      return NextResponse.redirect(correctDashboard)
    }
  }

  // 3. Auth pages — redirect logged-in users to their dashboard
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    (teamSlug && pathname === `/customer/${teamSlug}/login`)

  if (isAuthPage && user) {
    // Look up the user's actual team from the DB
    const { data: profile } = await supabase
      .from('profiles')
      .select('teams!inner(slug)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userTeamSlug = (profile as any)?.teams?.slug as string | undefined

    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = userTeamSlug
      ? `/customer/${userTeamSlug}/dashboard`
      : '/'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}
