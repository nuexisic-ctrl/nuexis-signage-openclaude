import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // CSRF protection: verify the request Origin matches our host.
  // This prevents cross-site sign-out attacks where a malicious page
  // triggers a POST to /auth/signout without user consent.
  const origin = new URL(request.url).origin
  const requestOrigin = request.headers.get('origin')
  const requestReferer = request.headers.get('referer')

  let isVerified = false
  if (requestOrigin) {
    isVerified = requestOrigin === origin
  } else if (requestReferer) {
    try {
      const refererOrigin = new URL(requestReferer).origin
      isVerified = refererOrigin === origin
    } catch {
      isVerified = false
    }
  }

  if (!isVerified) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}/login`, { status: 302 })
}

