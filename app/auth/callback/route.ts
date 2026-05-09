import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const teamSlugParam = searchParams.get('team_slug')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Prefer the team_slug from the URL param (set during signup redirectTo)
      // Fall back to the user's metadata if the param is missing
      const teamSlug =
        teamSlugParam ||
        (data.user.user_metadata?.team_slug as string | undefined)

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
