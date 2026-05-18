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

    const { data: device, error: sessionError } = await publicClient.rpc('validate_device_session', {
      p_device_id: body.deviceId,
      p_session_token: body.sessionToken,
    })

    const validated = device as { team_id?: string } | null
    if (sessionError || !validated?.team_id) {
      return NextResponse.json({ error: 'Unauthorized device session' }, { status: 401 })
    }

    if (!body.filePath.startsWith(`${validated.team_id}/`)) {
      return NextResponse.json({ error: 'Unauthorized media path' }, { status: 403 })
    }

    const serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await serviceClient.storage
      .from('workspace-media')
      .createSignedUrl(body.filePath, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Failed to sign media URL' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (error) {
    console.error('[player/media-url] error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
