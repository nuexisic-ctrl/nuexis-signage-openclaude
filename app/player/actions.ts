'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { redis, rateLimitAction } from '@/lib/redis'

/**
 * Creates a Supabase client using the ANON key (not the service-role key).
 * All player operations now go through SECURITY DEFINER RPCs,
 * so the anon key is sufficient — no RLS bypass needed.
 */
function getPlayerClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

export async function registerDevice(hardwareId: string, pairingCode: string, expiresAtMs: number) {
  if (!(await rateLimitAction(hardwareId, 'registerDevice', 5, 60))) {
    throw new Error('Too many registration attempts. Please try again later.')
  }

  const supabase = getPlayerClient()
  const { data, error } = await supabase.rpc('register_player_device', {
    p_hardware_id: hardwareId,
    p_pairing_code: pairingCode,
    p_expires_at: new Date(expiresAtMs).toISOString(),
  })

  if (error) {
    console.error('[registerDevice] Error:', error)
    throw new Error('Failed to register device')
  }

  const result = data as unknown as { id: string; expires_at: string; secret: string }
  return result
}

export async function refreshDeviceCode(
  deviceId: string,
  hardwareId: string,
  secret: string,
  pairingCode: string,
  expiresAtMs: number
) {
  if (!(await rateLimitAction(hardwareId, 'refreshDeviceCode', 10, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { data, error } = await supabase.rpc('refresh_player_device_code', {
    p_device_id: deviceId,
    p_hardware_id: hardwareId,
    p_secret: secret,
    p_pairing_code: pairingCode,
    p_expires_at: new Date(expiresAtMs).toISOString(),
  })

  if (error) {
    console.error('[refreshDeviceCode] Error:', error)
    throw new Error('Failed to refresh pairing code')
  }

  const result = data as unknown as { id: string; expires_at: string }
  return result
}

export async function getDeviceState(hardwareId: string, secret?: string) {
  if (!(await rateLimitAction(hardwareId, 'getDeviceState', 40, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { data, error } = await supabase.rpc('get_player_device_state', {
    p_hardware_id: hardwareId,
    p_secret: secret ?? undefined,
  })

  if (error) {
    console.error('[getDeviceState] Transient Error:', error)
    throw new Error('Failed to fetch device state due to network or database error')
  }

  return (data as unknown as {
    id: string
    team_id: string | null
    name: string | null
    pairing_code: string
    expires_at: string
    status: string
    content_type: string | null
    asset_id: string | null
    playlist_id: string | null
    orientation: number | null
    created_at: string
    last_seen_at: string | null
  }) || null
}

export async function unpairDevice(deviceId: string, hardwareId: string, secret: string) {
  if (!(await rateLimitAction(hardwareId, 'unpairDevice', 10, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { error } = await supabase.rpc('unpair_player_device', {
    p_device_id: deviceId,
    p_hardware_id: hardwareId,
    p_secret: secret,
  })

  if (error) {
    console.error('[unpairDevice] Error:', error)
    throw new Error('Failed to unpair device')
  }
}

export async function updateDeviceOrientation(
  deviceId: string,
  hardwareId: string,
  secret: string,
  orientation: number
) {
  if (!(await rateLimitAction(hardwareId, 'updateDeviceOrientation', 20, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { error } = await supabase.rpc('update_player_device_orientation', {
    p_device_id: deviceId,
    p_hardware_id: hardwareId,
    p_secret: secret,
    p_orientation: orientation,
  })

  if (error) {
    console.error('[updateDeviceOrientation] Error:', error)
    throw new Error('Failed to update device orientation')
  }
}

export async function incrementPlaytime(
  deviceId: string,
  hardwareId: string,
  secret: string,
  seconds: number
) {
  if (!(await rateLimitAction(hardwareId, 'incrementPlaytime', 20, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { error } = await supabase.rpc('increment_device_playtime', {
    p_device_id: deviceId,
    p_hardware_id: hardwareId,
    p_secret: secret,
    p_seconds: seconds,
  })

  if (error) {
    console.error('[incrementPlaytime] Error:', error)
  }
}

export async function sendHeartbeat(deviceId: string, teamId: string, hardwareId: string, secret: string) {
  if (!(await rateLimitAction(hardwareId, 'sendHeartbeat', 20, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { data: device, error } = await supabase.rpc('get_player_device_state', {
    p_hardware_id: hardwareId,
    p_secret: secret,
  })

  if (error || !device || (device as any).id !== deviceId || (device as any).team_id !== teamId) {
    throw new Error('Unauthorized heartbeat attempt')
  }

  try {
    await redis.setex(`heartbeat:${teamId}:${deviceId}`, 120, new Date().toISOString())
  } catch (error) {
    console.error('[sendHeartbeat] Error:', error)
  }
}

export async function getPlaylistItems(playlistId: string, hardwareId: string, secret: string) {
  if (!(await rateLimitAction(hardwareId, 'getPlaylistItems', 30, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabase = getPlayerClient()
  const { data, error } = await supabase.rpc('get_player_playlist_items', {
    p_playlist_id: playlistId,
    p_hardware_id: hardwareId,
    p_secret: secret,
  })

  if (error) {
    console.error('[getPlaylistItems] Error:', error)
    return []
  }

  return (data as unknown as Array<{
    id: string
    playlist_id: string | null
    type: string
    asset_id: string | null
    widget_type: string | null
    widget_config: unknown
    duration_seconds: number
    sort_order: number
    assets: { file_path: string; mime_type: string } | null
  }>) || []
}

/**
 * Generates a time-limited signed URL for a private storage asset.
 * This is the ONLY use of the service-role key — scoped exclusively
 * to storage URL signing. No database access is performed.
 */
export async function getSignedMediaUrl(
  filePath: string,
  hardwareId: string,
  secret: string,
  expiresIn: number = 3600
) {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }

  if (!(await rateLimitAction(hardwareId, 'getSignedMediaUrl', 60, 60))) {
    throw new Error('Rate limit exceeded')
  }

  const supabasePlayer = getPlayerClient()
  const { data: deviceData, error: devError } = await supabasePlayer.rpc('get_player_device_state', {
    p_hardware_id: hardwareId,
    p_secret: secret,
  })

  const device = deviceData as { team_id?: string } | null

  if (devError || !device || !device.team_id) {
    throw new Error('Unauthorized device')
  }

  if (!filePath.startsWith(`${device.team_id}/`)) {
    throw new Error('Unauthorized file path')
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: signedUrlData, error } = await supabase.storage
    .from('workspace-media')
    .createSignedUrl(filePath, expiresIn)

  if (error || !signedUrlData?.signedUrl) {
    console.error('[getSignedMediaUrl] Error:', error)
    throw new Error('Failed to generate media URL')
  }

  return signedUrlData.signedUrl
}
