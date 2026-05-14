'use server'

import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

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

  const headersList = await headers()
  const clientIp = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'

  // 2. Rate-limit check — count failed attempts within the rolling window
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )

  // Rate limit by IP address OR specific pairing code to prevent brute force
  const { count: ipCount, error: ipCountError } = await adminSupabase
    .from('claim_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', clientIp)
    .gte('attempted_at', windowStart)

  const { count: codeCount, error: codeCountError } = await adminSupabase
    .from('claim_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('pairing_code', trimmedCode)
    .gte('attempted_at', windowStart)

  if (ipCountError || codeCountError) {
    console.error('[claimDevice] rate-limit check error:', ipCountError || codeCountError)
  } else if ((ipCount !== null && ipCount >= MAX_ATTEMPTS) || (codeCount !== null && codeCount >= MAX_ATTEMPTS)) {
    console.warn('[claimDevice] rate limit exceeded for IP/code:', clientIp, trimmedCode)
    return {
      success: false,
      error: `Too many failed attempts. Please wait ${WINDOW_MINUTES} minutes before trying again.`,
    }
  }

  // 3. Get user's team_id from app_metadata in JWT
  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // 4. ATOMIC claim — single UPDATE with all conditions in WHERE clause.
  //    This eliminates the race condition where two users could claim the
  //    same device simultaneously. Only one UPDATE can succeed because
  //    the first one sets team_id to non-null, causing the second's
  //    WHERE team_id IS NULL to match 0 rows.
  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({
      team_id: teamId,
      name: trimmedName,
      status: 'online',
    })
    .eq('pairing_code', trimmedCode)
    .is('team_id', null)
    .gt('expires_at', new Date().toISOString())
    .select('id')

  console.log('[claimDevice] atomic update result:', updated, 'updateError:', updateError)

  if (updateError) {
    console.error('[claimDevice] update error:', { message: updateError.message, details: updateError.details, hint: updateError.hint })
    return { success: false, error: 'Failed to update screen settings. Please try again later.' }
  }

  // If 0 rows were affected, the code was invalid, expired, or already claimed
  if (!updated || updated.length === 0) {
    // Record this as a failed attempt for rate-limiting
    const { error: insertError } = await adminSupabase
      .from('claim_attempts')
      .insert({ user_id: user.id, ip_address: clientIp, pairing_code: trimmedCode })

    if (insertError) {
      console.error('[claimDevice] insert claim_attempts error:', { message: insertError.message, details: insertError.details, hint: insertError.hint })
      return { success: false, error: 'Maximum attempts exceeded or system error. Please try again later.' }
    }

    return { success: false, error: 'Invalid or expired pairing code. Please check the code on screen and try again.' }
  }

  console.log('[claimDevice] success! device', updated[0].id, 'claimed by team', teamId)

  // Success — clear any recorded failed attempts for this user/IP/code
  const { error: deleteError } = await adminSupabase
    .from('claim_attempts')
    .delete()
    .or(`user_id.eq.${user.id},ip_address.eq.${clientIp},pairing_code.eq.${trimmedCode}`)

  if (deleteError) {
    console.error('[claimDevice] clear claim_attempts error:', { message: deleteError.message, details: deleteError.details, hint: deleteError.hint })
  }

  // 5. Revalidate the screens page so the grid refreshes on next server render
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

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
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
