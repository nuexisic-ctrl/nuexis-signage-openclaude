import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { resilientFetch } from '@/lib/supabase/resilientFetch'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deviceId?: string
      hardwareId?: string
      secret?: string
      base64Data?: string
    }

    if (!body.deviceId || !body.hardwareId || !body.secret || !body.base64Data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Verify device credentials using Supabase RPC
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: resilientFetch }
      }
    )

    const { data: device, error: deviceError } = await anonClient
      .rpc('get_player_device_state', {
        p_hardware_id: body.hardwareId,
        p_secret: body.secret
      })

    if (deviceError || !device || (device as any).id !== body.deviceId) {
      return NextResponse.json({ error: 'Unauthorized device credentials' }, { status: 401 })
    }

    const teamId = (device as any).team_id
    if (!teamId) {
      return NextResponse.json({ error: 'Device is not paired to a team' }, { status: 400 })
    }

    // 2. Decode base64 image data to Buffer
    let base64Clean = body.base64Data
    if (base64Clean.includes(';base64,')) {
      base64Clean = base64Clean.split(';base64,')[1]
    }
    const buffer = Buffer.from(base64Clean, 'base64')

    // 3. Upload screenshot buffer to Supabase Storage
    const adminClient = createAdminClient()
    const filePath = `${teamId}/screenshots/${body.deviceId}.png`

    const { error: uploadError } = await adminClient.storage
      .from('workspace-media')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) {
      console.error('[player/screenshot] Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload screenshot' }, { status: 500 })
    }

    return NextResponse.json({ success: true, filePath })
  } catch (error) {
    console.error('[player/screenshot] exception:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
