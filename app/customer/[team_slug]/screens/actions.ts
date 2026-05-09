'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PairDeviceResult =
  | { success: true }
  | { success: false; error: string }

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

  // 2. Get user's team_id from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  console.log('[claimDevice] profile:', profile, 'profileError:', profileError)

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // 3. Find an unclaimed, non-expired device with this code
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
    return { success: false, error: 'Invalid or expired pairing code. Please check the code on screen and try again.' }
  }

  // 4. Claim the device — assign team_id, name, and mark online
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

  // 5. Revalidate the screens page so the grid refreshes on next server render
  revalidatePath(`/customer/${teamSlug}/screens`)

  return { success: true }
}
