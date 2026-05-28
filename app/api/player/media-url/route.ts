import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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

    if (body.filePath.startsWith('http://') || body.filePath.startsWith('https://')) {
      return NextResponse.json({ signedUrl: body.filePath })
    }

    const publicClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
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
