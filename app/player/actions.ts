'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const DEVICE_PUBLIC_FIELDS =
  'id, team_id, name, pairing_code, expires_at, status, content_type, asset_id, scale_mode, orientation, created_at, last_seen_at'

function getPlayerAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

export async function registerDevice(hardwareId: string, pairingCode: string, expiresAtMs: number) {
  const secret = crypto.randomUUID()
  const supabase = getPlayerAdminClient()
  const { data, error } = await supabase
    .from('devices')
    .insert({
      hardware_id: hardwareId,
      pairing_code: pairingCode,
      status: 'pairing',
      expires_at: new Date(expiresAtMs).toISOString(),
      secret: secret
    })
    .select('id, expires_at, secret')
    .single()

  if (error) {
    console.error('[registerDevice] Error:', error)
    throw new Error('Failed to register device')
  }
  return data
}

export async function refreshDeviceCode(deviceId: string, hardwareId: string, secret: string, pairingCode: string, expiresAtMs: number) {
  const supabase = getPlayerAdminClient()
  const { data, error } = await supabase
    .from('devices')
    .update({
      pairing_code: pairingCode,
      status: 'pairing',
      expires_at: new Date(expiresAtMs).toISOString()
    })
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)
    .eq('secret', secret)
    .is('team_id', null)
    .select('id, expires_at')
    .single()

  if (error) {
    console.error('[refreshDeviceCode] Error:', error)
    throw new Error('Failed to refresh pairing code')
  }
  return data
}

export async function getDeviceState(hardwareId: string, secret?: string) {
  const supabase = getPlayerAdminClient()
  // Explicitly select only public fields, never return hardware_id or secret to the client state
  let query = supabase
    .from('devices')
    .select(DEVICE_PUBLIC_FIELDS)
    .eq('hardware_id', hardwareId)

  query = secret ? query.eq('secret', secret) : query.is('team_id', null)

  const finalQuery = query.maybeSingle()

  const { data, error } = await finalQuery

  if (error) {
    console.error('[getDeviceState] Error:', error)
    throw new Error('Failed to get device state')
  }
  
  return data || null
}

export async function unpairDevice(deviceId: string, hardwareId: string, secret: string) {
  const supabase = getPlayerAdminClient()
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)
    .eq('secret', secret)

  if (error) {
    console.error('[unpairDevice] Error:', error)
    throw new Error('Failed to unpair device')
  }
}

export async function updateDeviceOrientation(deviceId: string, hardwareId: string, secret: string, orientation: number) {
  const supabase = getPlayerAdminClient()
  const { error } = await supabase
    .from('devices')
    .update({ orientation })
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)
    .eq('secret', secret)

  if (error) {
    console.error('[updateDeviceOrientation] Error:', error)
    throw new Error('Failed to update device orientation')
  }
}
