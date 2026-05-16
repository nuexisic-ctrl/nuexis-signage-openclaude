import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Player is always public and uses device_secret for auth — no user session needed.
  // We completely bypass Supabase Auth for /player routes to prevent massive API scaling issues
  // where thousands of screens would constantly ping /auth/v1/user unnecessarily.
  if (pathname.startsWith('/player')) {
    return NextResponse.next()
  }

  const supabaseResponse = await updateSession(request)

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
