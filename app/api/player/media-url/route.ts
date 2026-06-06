import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { rateLimitAction } from '@/lib/redis'
import { resilientFetch } from '@/lib/supabase/resilientFetch'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deviceId?: string
      sessionToken?: string
      filePath?: string
    }

    if (!body.deviceId || !body.sessionToken || !body.filePath) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // H-02: Validate input formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID format' }, { status: 400 })
    }

    // Reject path traversal attempts
    if (body.filePath.includes('..') || body.filePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // H-02: Rate limit by deviceId (60 requests per minute)
    if (!(await rateLimitAction(body.deviceId, 'mediaUrl', 60, 60))) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // H-02: Rate limit by IP (120 requests per minute)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!(await rateLimitAction(ip, 'mediaUrl:ip', 120, 60))) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    if (body.filePath.startsWith('http://') || body.filePath.startsWith('https://')) {
      if (body.filePath.startsWith('http://')) {
        return NextResponse.json({ error: 'Insecure protocol: only HTTPS is allowed' }, { status: 400 })
      }
      try {
        const parsedUrl = new URL(body.filePath)
        const allowedHosts = [
          'youtube.com',
          'www.youtube.com',
          'youtu.be',
          'youtube-nocookie.com',
          'www.youtube-nocookie.com',
        ]
        
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          try {
            const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
            allowedHosts.push(supabaseHost)
          } catch {}
        }
        
        const isAllowed = allowedHosts.some(host => 
          parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
        )
        
        if (!isAllowed) {
          return NextResponse.json({ error: 'Untrusted external URL' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
      }
      return NextResponse.json({ signedUrl: body.filePath })
    }

    const publicClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: resilientFetch }
      }
    )

    const { data: signedUrl, error } = await publicClient.rpc('get_player_signed_media_url_by_session', {
      p_device_id: body.deviceId,
      p_session_token: body.sessionToken,
      p_file_path: body.filePath,
      p_expires_in: 3600
    })

    if (error || !signedUrl) {
      console.error('[player/media-url] rpc error:', error)
      return NextResponse.json({ error: 'Unauthorized or failed to sign media URL' }, { status: 401 })
    }

    return NextResponse.json({ signedUrl })
  } catch (error) {
    console.error('[player/media-url] error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
