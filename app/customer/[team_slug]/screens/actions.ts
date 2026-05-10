'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PairDeviceResult =
  | { success: true }
  | { success: false; error: string }

// Rate-limiting constants
const MAX_ATTEMPTS   = 5
const WINDOW_MINUTES = 15

export async function claimDevice(
  teamSlug: string,
  pairingCode: string,
  screenName: string
): Promise<PairDeviceResult> {
  const trimmedCode = pairingCode.trim().replace(/\s/g, '')
  const trimmedName = screenName.trim()

  console.log('[claimDevice] called with code:', trimmedCode, 'name:', trimmedName, 'team:', teamSlug)

  if (!/^\d{6}$/.test(trimmedCode)) {
    return { success: false, error: 'Please enter a valid 6-digit pairing code.' }
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

  // 2. Rate-limit check — count failed attempts within the rolling window
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { count, error: countError } = await supabase
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('attempted_at', windowStart)

  if (countError) {
    console.error('[claimDevice] rate-limit check error:', countError)
    // Non-fatal — allow through if we can't read the count
  } else if (count !== null && count >= MAX_ATTEMPTS) {
    console.warn('[claimDevice] rate limit exceeded for user:', user.id)
    return {
      success: false,
      error: `Too many failed attempts. Please wait ${WINDOW_MINUTES} minutes before trying again.`,
    }
  }

  // 3. Get user's team_id from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  console.log('[claimDevice] profile:', profile, 'profileError:', profileError)

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // 4. Find an unclaimed, non-expired device with this code
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('id, expires_at')
    .eq('pairing_code', trimmedCode)
    .is('team_id', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  console.log('[claimDevice] found device:', device, 'deviceError:', deviceError)

  if (deviceError) {
    console.error('[claimDevice] device lookup error:', deviceError)
    return { success: false, error: 'An error occurred while looking up the code. Please try again.' }
  }

  if (!device) {
    // Record this as a failed attempt for rate-limiting
    await supabase
      .from('login_attempts')
      .insert({ user_id: user.id })

    return { success: false, error: 'Invalid or expired pairing code. Please check the code on screen and try again.' }
  }

  // 5. Claim the device — assign team_id, name, and mark online
  // Use select() to detect if RLS silently blocked the update (0 rows affected)
  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({
      team_id: profile.team_id,
      name: trimmedName,
      status: 'online',
    })
    .eq('id', device.id)
    .select('id')

  console.log('[claimDevice] update result:', updated, 'updateError:', updateError)

  if (updateError) {
    console.error('[claimDevice] update error:', updateError)
    return { success: false, error: `Failed to pair the screen: ${updateError.message}` }
  }

  // If RLS blocked the update, updated will be an empty array
  if (!updated || updated.length === 0) {
    console.error('[claimDevice] update was silently blocked by RLS — 0 rows affected')
    return { success: false, error: 'Permission denied: could not claim this device. Please try again.' }
  }

  console.log('[claimDevice] success! device', device.id, 'claimed by team', profile.team_id)

  // Success — clear any recorded failed attempts for this user
  await supabase
    .from('login_attempts')
    .delete()
    .eq('user_id', user.id)

  // 6. Revalidate the screens page so the grid refreshes on next server render
  revalidatePath(`/customer/${teamSlug}/screens`)

  return { success: true }
}

export interface AssignmentData {
  content_type: 'Asset' | 'Playlist' | 'Schedule'
  asset_id: string | null
  scale_mode: 'None' | 'Fit' | 'Stretch' | 'Zoom'
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({
      content_type: data.content_type,
      asset_id: data.asset_id,
      scale_mode: data.scale_mode,
      orientation: data.orientation,
    })
    .eq('id', deviceId)
    .eq('team_id', profile.team_id)
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[updateDeviceAssignment] update error:', updateError)
    return { success: false, error: 'Failed to update screen assignment. Permission denied or device not found.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  return { success: true }
}

