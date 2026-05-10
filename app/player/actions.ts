'use server'

import { createClient } from '@supabase/supabase-js'

// We use the service role key to securely bypass RLS for player mutations.
// This prevents malicious actors from directly calling Supabase APIs to hijack screens.
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function registerDevice(hardwareId: string, pairingCode: string, expiresAtMs: number) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('devices')
    .insert({
      hardware_id: hardwareId,
      pairing_code: pairingCode,
      status: 'pairing',
      expires_at: new Date(expiresAtMs).toISOString()
    })
    .select('id, expires_at')
    .single()

  if (error) {
    console.error('[registerDevice] Error:', error)
    throw new Error('Failed to register device')
  }
  return data
}

export async function refreshDeviceCode(deviceId: string, hardwareId: string, pairingCode: string, expiresAtMs: number) {
  const supabase = getAdminClient()
  // We enforce that the hardware_id matches to prevent spoofing
  const { data, error } = await supabase
    .from('devices')
    .update({
      pairing_code: pairingCode,
      status: 'pairing',
      expires_at: new Date(expiresAtMs).toISOString()
    })
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)
    .select('id, expires_at')
    .single()

  if (error) {
    console.error('[refreshDeviceCode] Error:', error)
    throw new Error('Failed to refresh pairing code')
  }
  return data
}

export async function heartbeatDevice(deviceId: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', deviceId)

  if (error) {
    console.error('[heartbeatDevice] Error:', error)
    throw new Error('Failed to send heartbeat')
  }
}

export async function getDeviceState(hardwareOrDeviceId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .or(`hardware_id.eq.${hardwareOrDeviceId},id.eq.${hardwareOrDeviceId}`)
    .maybeSingle()

  if (error) {
    console.error('[getDeviceState] Error:', error)
    throw new Error('Failed to get device state')
  }
  return data
}
