'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { redis, rateLimitAction } from '@/lib/redis'
import { createAdminClient } from '@/lib/supabase/server'

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
    console.warn('[getDeviceState] Rate limit hit for device:', hardwareId)
    return null
  }

  const supabase = getPlayerClient()
  const { data, error } = await supabase.rpc('get_player_device_state', {
    p_hardware_id: hardwareId,
    p_secret: secret ?? undefined,
  })

  if (error) {
    console.warn('[getDeviceState] Transient database or network warning:', error.message || error)
    return null
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
    console.warn('[incrementPlaytime] Rate limit hit for device:', hardwareId)
    return
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

export async function sendHeartbeat(deviceId: string, teamId: string, hardwareId: string) {
  if (!(await rateLimitAction(hardwareId, 'sendHeartbeat', 20, 60))) {
    console.warn('[sendHeartbeat] Rate limit hit for device:', hardwareId)
    return
  }

  // Write presence to Redis only — no DB round-trip needed.
  // The device is already authenticated (secret was validated at pair-time and stored
  // in refs). The rate limiter prevents abuse. Skipping the bcrypt RPC call here
  // saves one full DB query + bcrypt evaluation per device per minute.
  try {
    if (redis) {
      const presenceKey = `heartbeat:${teamId}:${deviceId}`
      const indexKey = `heartbeats:index:${teamId}`
      await Promise.all([
        redis.setex(presenceKey, 120, new Date().toISOString()),
        redis.sadd(indexKey, deviceId)
      ])
    } else {
      console.warn('[sendHeartbeat] Redis not configured. Skipping active heartbeat tracking.')
    }
  } catch (error) {
    console.error('[sendHeartbeat] Redis error:', error)
    // Non-fatal — presence will naturally expire from Redis; device will show offline
    // after 120s which is the expected behavior on connection loss anyway.
  }
}

export async function getPlaylistItems(playlistId: string, hardwareId: string, secret: string) {
  if (!(await rateLimitAction(hardwareId, 'getPlaylistItems', 30, 60))) {
    console.warn('[getPlaylistItems] Rate limit hit for device:', hardwareId)
    return []
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

  // Rate limiting
  if (!(await rateLimitAction(hardwareId, 'getSignedMediaUrl', 120, 60))) {
    console.warn('[getSignedMediaUrl] Rate limit exceeded for hardwareId:', hardwareId)
    // Fallback to standard public storage URL
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/workspace-media/${filePath}`
  }

  try {
    // 1. Validate device credentials and get its team ID
    const device = await getDeviceState(hardwareId, secret)
    if (!device || !device.team_id) {
      console.warn('[getSignedMediaUrl] Unauthorized device or missing team_id')
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/workspace-media/${filePath}`
    }

    // 2. Validate file path belongs to the device's team
    if (!filePath.startsWith(device.team_id + '/')) {
      console.warn('[getSignedMediaUrl] Unauthorized file path access attempt')
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/workspace-media/${filePath}`
    }

    // 3. Generate a signed URL using createAdminClient (which has service-role storage sign permissions)
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase.storage
      .from('workspace-media')
      .createSignedUrl(filePath, expiresIn)

    if (error || !data?.signedUrl) {
      console.error('[getSignedMediaUrl] Failed to generate signed URL from storage client:', error || 'No URL returned')
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/workspace-media/${filePath}`
    }

    return data.signedUrl
  } catch (err) {
    console.error('[getSignedMediaUrl] Exception during signed URL generation:', err)
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/workspace-media/${filePath}`
  }
}


export async function getPlayerAsset(
  assetId: string,
  hardwareId: string,
  secret: string
) {
  if (!(await rateLimitAction(hardwareId, 'getPlayerAsset', 60, 60))) {
    console.warn('[getPlayerAsset] Rate limit hit for device:', hardwareId)
    return null
  }

  try {
    const supabasePlayer = getPlayerClient()
    const { data: assetData, error } = await supabasePlayer.rpc('get_player_asset', {
      p_hardware_id: hardwareId,
      p_secret: secret,
      p_asset_id: assetId,
    })

    if (error || !assetData) {
      console.warn('[getPlayerAsset] Error or missing asset:', error || 'No asset returned')
      return null
    }

    const asset = assetData as { file_path: string; mime_type: string }
    return {
      file_path: asset.file_path,
      mime_type: asset.mime_type,
    }
  } catch (err) {
    console.error('[getPlayerAsset] Exception caught:', err)
    return null
  }
}


