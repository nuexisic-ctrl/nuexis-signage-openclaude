'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redis, rateLimitAction } from '@/lib/redis'

export type PairDeviceResult =
  | { success: true }
  | { success: false; error: string }

export async function claimDevice(
  teamSlug: string,
  pairingCode: string,
  screenName: string
): Promise<PairDeviceResult> {
  try {
    const trimmedCode = pairingCode.trim().replace(/\s/g, '').toUpperCase()
    const trimmedName = screenName.trim()

    if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
      return { success: false, error: 'Please enter a valid 6-character pairing code.' }
    }

    const supabase = await createClient()

    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'You must be logged in to add a screen.' }
    }

    // 2. Get user's team_id from app_metadata in JWT
    const teamId = user.app_metadata?.team_id as string | undefined

    if (!teamId) {
      return { success: false, error: 'Could not determine your team. Please try again.' }
    }

    try {
      await requireOwner(supabase, user.id)
    } catch (err: any) {
      return { success: false, error: err.message }
    }

    if (!(await rateLimitAction(user.id, 'claimDevice', 20, 60))) {
      return { success: false, error: 'Too many requests. Please try again later.' }
    }

    // 3. Generate default name as sequential "Screen N" when name is optional
    let finalName = trimmedName
    if (!finalName) {
      const { count } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
      finalName = `Screen ${(count || 0) + 1}`
    }

    // 4. Call the SECURITY DEFINER RPC — handles atomic claim and attempt tracking.
    const { data, error: rpcError } = await supabase.rpc('claim_device', {
      p_pairing_code: trimmedCode,
      p_team_id: teamId,
      p_name: finalName,
      p_user_id: user.id,
    })

    if (rpcError) {
      console.error('[claimDevice] RPC error:', rpcError)
      return { success: false, error: 'Failed to pair screen. Please try again later.' }
    }

    const result = data as unknown as { success: boolean; error?: string; device_id?: string }

    if (!result.success) {
      console.warn('[claimDevice] claim rejected:', result.error)
      return { success: false, error: result.error || 'Unknown error' }
    }

    // Revalidate the screens page so the grid refreshes on next server render
    revalidatePath(`/customer/${teamSlug}/screens`)

    return { success: true }
  } catch (err: any) {
    // Prevent any unexpected throw from crashing the page with the
    // "An error occurred in the Server Components render" error boundary.
    console.error('[claimDevice] Unexpected error:', err?.message ?? err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

export interface AssignmentData {
  content_type: 'Asset' | 'Playlist' | 'Schedule' | null
  asset_id: string | null
  playlist_id?: string | null
  orientation: 0 | 90 | 180 | 270
}

export async function updateDeviceAssignment(
  teamSlug: string,
  deviceId: string,
  data: AssignmentData
): Promise<PairDeviceResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to update a screen.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  // Server-side validation of content type assignment
  if (data.content_type === 'Asset' && data.asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id, team_id, mime_type')
      .eq('id', data.asset_id)
      .single()

    if (assetError || !asset || asset.team_id !== teamId) {
      return { success: false, error: 'Invalid or unauthorized asset selected.' }
    }
    if (asset.mime_type === 'application/x-folder') {
      return { success: false, error: 'Folders cannot be assigned to screens.' }
    }
  } else if (data.content_type === 'Playlist' && data.playlist_id) {
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, team_id')
      .eq('id', data.playlist_id)
      .single()

    if (playlistError || !playlist || playlist.team_id !== teamId) {
      return { success: false, error: 'Invalid or unauthorized playlist selected.' }
    }
  }

  const assignmentQuery = supabase
    .from('devices')
    .update({
      content_type: data.content_type,
      content: null,
      asset_id: data.asset_id,
      playlist_id: data.playlist_id,
      orientation: data.orientation,
    })

  const { data: updated, error: updateError } = deviceId.includes(',')
    ? await assignmentQuery.in('id', deviceId.split(',')).eq('team_id', teamId).select('id')
    : await assignmentQuery.eq('id', deviceId).eq('team_id', teamId).select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[updateDeviceAssignment] update error:', updateError ? { message: updateError.message, details: updateError.details, hint: updateError.hint } : 'No rows updated')
    return { success: false, error: 'Failed to update screen settings. Please try again later.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  return { success: true }
}

export async function deleteAndUnpairDevice(
  teamSlug: string,
  deviceId: string
): Promise<PairDeviceResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to delete a screen.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'deleteAndUnpairDevice', 10, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const ids = deviceId.split(',')

  const { error: deleteError } = await supabase
    .from('devices')
    .delete()
    .in('id', ids)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[deleteAndUnpairDevice] delete error:', { message: deleteError.message, details: deleteError.details, hint: deleteError.hint })
    return { success: false, error: 'Failed to update screen settings. Please try again later.' }
  }

  try {
    if (redis) {
      const redisClient = redis
      await Promise.all(
        ids.flatMap(id => [
          redisClient.del(`heartbeat:${teamId}:${id}`),
          redisClient.srem(`heartbeats:index:${teamId}`, id)
        ])
      )
    }
  } catch (err) {
    console.error('[deleteAndUnpairDevice] Redis cleanup failed:', err)
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  return { success: true }
}

export async function getDeviceHeartbeats(teamId: string): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized access')
  }

  const userTeamId = user.app_metadata?.team_id as string | undefined
  if (!userTeamId || userTeamId !== teamId) {
    throw new Error('Unauthorized team access')
  }

  if (!redis) {
    console.warn('[getDeviceHeartbeats] Redis is not configured. Returning empty heartbeats map.')
    return {}
  }

  try {
    const indexKey = `heartbeats:index:${teamId}`
    const deviceIds = await redis.smembers(indexKey)
    if (!deviceIds || deviceIds.length === 0) return {}

    const keys = deviceIds.map(id => `heartbeat:${teamId}:${id}`)
    const values = await redis.mget(...keys)
    const result: Record<string, string> = {}
    const expiredDeviceIds: string[] = []

    deviceIds.forEach((id, index) => {
      const val = values[index]
      if (val) {
        result[id] = val as string
      } else {
        expiredDeviceIds.push(id)
      }
    })

    if (expiredDeviceIds.length > 0) {
      redis.srem(indexKey, ...expiredDeviceIds).catch(err => {
        console.error('[getDeviceHeartbeats] failed to cleanup expired keys:', err)
      })
    }

    return result
  } catch (error) {
    console.error('[getDeviceHeartbeats] error:', error)
    return {}
  }
}

export async function updateDeviceLastSeen(
  teamSlug: string,
  deviceIds: string[]
): Promise<{ success: boolean }> {
  if (!deviceIds.length) return { success: true }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false }
  }

  // Rate limit: max 10 calls per 60 seconds per team to prevent DoS
  if (!(await rateLimitAction(teamId, 'updateDeviceLastSeen', 10, 60))) {
    console.warn('[updateDeviceLastSeen] Rate limit exceeded for team:', teamId)
    return { success: false }
  }

  const { error } = await supabase
    .from('devices')
    .update({
      status: 'offline'
    })
    .in('id', deviceIds)
    .eq('team_id', teamId)

  if (error) {
    console.error('[updateDeviceLastSeen] error:', error)
    return { success: false }
  }

  return { success: true }
}

export async function updateDeviceName(
  teamSlug: string,
  deviceId: string,
  newName: string
): Promise<PairDeviceResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to rename a screen.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'updateDeviceName', 30, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({ name: newName.trim() })
    .eq('id', deviceId)
    .eq('team_id', teamId)
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[updateDeviceName] update error:', updateError ? { message: updateError.message, details: updateError.details, hint: updateError.hint } : 'No rows updated')
    return { success: false, error: 'Failed to rename screen. Please try again later.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  return { success: true }
}
