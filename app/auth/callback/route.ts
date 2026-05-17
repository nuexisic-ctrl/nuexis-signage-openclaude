import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // SECURITY FIX (4.5): Never trust URL-supplied team_slug for redirect.
      // Always fetch the team slug from the database using the authenticated user's ID.
      // This prevents an attacker from crafting a callback URL that redirects to
      // another tenant's dashboard.
      const { data: profile } = await supabase
        .from('profiles')
        .select('teams(slug)')
        .eq('id', data.user.id)
        .single()

      const teamSlug = profile?.teams && !Array.isArray(profile.teams)
        ? profile.teams.slug
        : null

      if (teamSlug) {
        return NextResponse.redirect(`${origin}/customer/${teamSlug}/dashboard`)
      }

      // Fallback: user has a session but no team slug — send to home
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // Auth failed — redirect to generic login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
