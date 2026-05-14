'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

async function getPlayerClient(hardwareId: string, secret?: string) {
  const cookieStore = await cookies()
  const headers: Record<string, string> = {
    'x-hardware-id': hardwareId
  }
  if (secret) {
    headers['x-device-secret'] = secret
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers
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
  const secret = crypto.randomUUID()
  const supabase = await getPlayerClient(hardwareId, secret)
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
  const supabase = await getPlayerClient(hardwareId, secret)
  const { data, error } = await supabase
    .from('devices')
    .update({
      pairing_code: pairingCode,
      status: 'pairing',
      expires_at: new Date(expiresAtMs).toISOString()
    })
    .eq('id', deviceId)
    .select('id, expires_at')
    .single()

  if (error) {
    console.error('[refreshDeviceCode] Error:', error)
    throw new Error('Failed to refresh pairing code')
  }
  return data
}

export async function getDeviceState(hardwareId: string, secret?: string) {
  const supabase = await getPlayerClient(hardwareId, secret)
  // Explicitly select only public fields, never return hardware_id or secret to the client state
  const query = supabase
    .from('devices')
    .select('id, team_id, name, pairing_code, expires_at, status, content_type, asset_id, scale_mode, orientation, created_at, last_seen_at')
    .eq('hardware_id', hardwareId)
    .maybeSingle()

  const { data, error } = await query

  if (error) {
    console.error('[getDeviceState] Error:', error)
    throw new Error('Failed to get device state')
  }
  
  return data || null
}

export async function unpairDevice(deviceId: string, hardwareId: string, secret: string) {
  const supabase = await getPlayerClient(hardwareId, secret)
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)

  if (error) {
    console.error('[unpairDevice] Error:', error)
    throw new Error('Failed to unpair device')
  }
}

export async function updateDeviceOrientation(deviceId: string, hardwareId: string, secret: string, orientation: number) {
  const supabase = await getPlayerClient(hardwareId, secret)
  const { error } = await supabase
    .from('devices')
    .update({ orientation })
    .eq('id', deviceId)

  if (error) {
    console.error('[updateDeviceOrientation] Error:', error)
    throw new Error('Failed to update device orientation')
  }
}
