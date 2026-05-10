'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

async function getPlayerClient(hardwareId: string) {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          'x-hardware-id': hardwareId
        }
      },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch (error) {}
        }
      }
    }
  )
}

export async function registerDevice(hardwareId: string, pairingCode: string, expiresAtMs: number) {
  const supabase = await getPlayerClient(hardwareId)
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
  // We enforce that the hardware_id matches to prevent spoofing
  const supabase = await getPlayerClient(hardwareId)
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

export async function heartbeatDevice(deviceId: string, hardwareId: string) {
  const supabase = await getPlayerClient(hardwareId)
  const { error } = await supabase
    .from('device_heartbeats')
    .upsert({
      device_id: deviceId,
      hardware_id: hardwareId,
      last_seen_at: new Date().toISOString()
    })

  if (error) {
    console.error('[heartbeatDevice] Error:', error)
    throw new Error('Failed to send heartbeat')
  }
}

export async function getDeviceState(hardwareId: string) {
  const supabase = await getPlayerClient(hardwareId)
  // Explicitly select only public fields, never return hardware_id to the client
  const query = supabase
    .from('devices')
    .select('id, team_id, name, pairing_code, expires_at, status, content_type, asset_id, scale_mode, orientation, created_at, device_heartbeats(last_seen_at)')
    .eq('hardware_id', hardwareId)
    .maybeSingle()

  const { data, error } = await query

  if (error) {
    console.error('[getDeviceState] Error:', error)
    throw new Error('Failed to get device state')
  }
  
  if (data) {
    const { device_heartbeats, ...rest } = data
    const hb = Array.isArray(device_heartbeats) ? device_heartbeats[0] : device_heartbeats
    return {
      ...rest,
      last_seen_at: hb?.last_seen_at || null
    }
  }
  return null
}

export async function unpairDevice(deviceId: string, hardwareId: string) {
  const supabase = await getPlayerClient(hardwareId)
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)

  if (error) {
    console.error('[unpairDevice] Error:', error)
    throw new Error('Failed to unpair device')
  }
}

export async function updateDeviceOrientation(deviceId: string, hardwareId: string, orientation: number) {
  const supabase = await getPlayerClient(hardwareId)
  const { error } = await supabase
    .from('devices')
    .update({ orientation })
    .eq('id', deviceId)
    .eq('hardware_id', hardwareId)

  if (error) {
    console.error('[updateDeviceOrientation] Error:', error)
    throw new Error('Failed to update device orientation')
  }
}
