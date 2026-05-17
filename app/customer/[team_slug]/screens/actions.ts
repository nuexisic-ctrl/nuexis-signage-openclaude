'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redis } from '@/lib/redis'

export type PairDeviceResult =
  | { success: true }
  | { success: false; error: string }

export async function claimDevice(
  teamSlug: string,
  pairingCode: string,
  screenName: string
): Promise<PairDeviceResult> {
  const trimmedCode = pairingCode.trim().replace(/\s/g, '').toUpperCase()
  const trimmedName = screenName.trim()

  console.log('[claimDevice] called with code:', trimmedCode, 'name:', trimmedName, 'team:', teamSlug)

  if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
    return { success: false, error: 'Please enter a valid 6-character pairing code.' }
  }
  if (!trimmedName) {
    return { success: false, error: 'Please provide a name for this screen.' }
  }

  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('[claimDevice] user:', user?.id, 'authError:', authError)

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to add a screen.' }
  }

  // 2. Get user's team_id from app_metadata in JWT
  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // 3. Call the SECURITY DEFINER RPC — handles rate-limiting, atomic claim,
  //    attempt tracking, and cleanup all in a single database transaction.
  //    No service-role key needed.
  const { data, error: rpcError } = await supabase.rpc('claim_device', {
    p_pairing_code: trimmedCode,
    p_team_id: teamId,
    p_name: trimmedName,
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

  console.log('[claimDevice] success! device', result.device_id, 'claimed by team', teamId)

  // 4. Revalidate the screens page so the grid refreshes on next server render
  revalidatePath(`/customer/${teamSlug}/screens`)

  return { success: true }
}

export interface AssignmentData {
  content_type: 'Asset' | 'Playlist' | 'Schedule'
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

  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({
      content_type: data.content_type,
      asset_id: data.asset_id,
      playlist_id: data.playlist_id,
      orientation: data.orientation,
    })
    .eq('id', deviceId)
    .eq('team_id', teamId)
    .select('id')

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

  const { error: deleteError } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[deleteAndUnpairDevice] delete error:', { message: deleteError.message, details: deleteError.details, hint: deleteError.hint })
    return { success: false, error: 'Failed to update screen settings. Please try again later.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  return { success: true }
}

export async function getDeviceHeartbeats(teamId: string): Promise<Record<string, string>> {
  try {
    const keys = await redis.keys(`heartbeat:${teamId}:*`)
    if (keys.length === 0) return {}

    const values = await redis.mget(...keys)
    const result: Record<string, string> = {}
    
    keys.forEach((key, index) => {
      const deviceId = key.split(':').pop()
      if (deviceId && values[index]) {
        result[deviceId] = values[index] as string
      }
    })
    
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

  const { error } = await supabase
    .from('devices')
    .update({
      status: 'offline',
      last_seen_at: new Date().toISOString(),
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
