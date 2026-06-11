import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { redis } from '@/lib/redis'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fetch allowed domains from Redis
  let allowedDomains: string[] = []
  try {
    if (redis) {
      const cached = await redis.get<string | string[]>('allowed_domains:all')
      if (cached) {
        allowedDomains = typeof cached === 'string' ? JSON.parse(cached) : cached
      }
    }
  } catch (err) {
    console.error('[middleware] Failed to fetch allowed domains from Redis:', err)
  }

  // Construct dynamic CSP
  const allowedDomainsStr = allowedDomains.map(d => `https://${d} https://*.${d}`).join(' ')
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com ${allowedDomainsStr}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
  ].join('; ')

  let response: NextResponse

  if (pathname.startsWith('/player')) {
    // Player is always public and uses device_secret for auth — no user session needed.
    // We completely bypass Supabase Auth for /player routes to prevent massive API scaling issues
    response = NextResponse.next()
  } else if (pathname === '/') {
    // Landing page is public — no session needed
    response = NextResponse.next()
  } else if (pathname.startsWith('/api/')) {
    // API routes handle their own auth
    response = NextResponse.next()
  } else {
    response = await updateSession(request)
  }

  // Inject the dynamic CSP header
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
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
