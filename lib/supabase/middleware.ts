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

    // 2. Cross-tenant check — ensure the logged-in user belongs to this team
    const userTeamSlug = user.user_metadata?.team_slug as string | undefined
    if (userTeamSlug && userTeamSlug !== teamSlug) {
      // Redirect to the user's actual dashboard, not the one they typed in the URL
      const correctDashboard = request.nextUrl.clone()
      correctDashboard.pathname = `/customer/${userTeamSlug}/dashboard`
      return NextResponse.redirect(correctDashboard)
    }
  }

  // 2. Auth pages — redirect logged-in users to their dashboard
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    (teamSlug && pathname === `/customer/${teamSlug}/login`)

  if (isAuthPage && user) {
    // Look up the user's team slug from metadata
    const userTeamSlug =
      user.user_metadata?.team_slug as string | undefined

    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = userTeamSlug
      ? `/customer/${userTeamSlug}/dashboard`
      : '/'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}
