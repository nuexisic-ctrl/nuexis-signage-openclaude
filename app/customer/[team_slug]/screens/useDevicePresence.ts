'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Device } from './types'

const mapDevice = (d: any): Device => ({
  id: d.id,
  name: d.name,
  status: d.status,
  created_at: d.created_at,
  content_type: d.content_type,
  asset_id: d.asset_id,
  playlist_id: d.playlist_id,
  orientation: d.orientation,
  last_seen_at: d.last_seen_at || null,
  total_playtime_seconds: Number(d.total_playtime_seconds) || 0,
  app_version: d.app_version || null,
  os_version: d.os_version || null,
  scale_mode: d.scale_mode || null,
})

export function useDevicePresence(
  initialDevices: Device[],
  teamId: string,
  teamSlug: string,
  isRefreshing: boolean,
  router: any
) {
  const supabase = createClient()
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set())
  const [hasSyncedPresence, setHasSyncedPresence] = useState(false)
  const [presenceRefreshKey, setPresenceRefreshKey] = useState(0)

  const teamChannelRef = useRef<any>(null)
  const hasSyncedPresenceRef = useRef(false)

  // Sync state when initialDevices update
  useEffect(() => {
    setDevices(initialDevices)
  }, [initialDevices])

  // ── Persistent presence channel ────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    let isUnmounting = false
    hasSyncedPresenceRef.current = false
    setHasSyncedPresence(false)

    const channel = supabase
      .channel(`team-status:${teamId}`)
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState<{ device_id: string }>()
          const ids = new Set(
            Object.values(state)
              .flat()
              .map((p) => p.device_id)
              .filter(Boolean)
          )
          setOnlineDeviceIds(ids)
          if (!hasSyncedPresenceRef.current) {
            hasSyncedPresenceRef.current = true
            setHasSyncedPresence(true)
          }
        } catch (err) {
          console.error('[useDevicePresence] Error syncing presence state:', err)
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          if (isUnmounting) return
          console.warn(`[Dashboard] Presence channel ${status}. Auto-reconnecting...`)
          hasSyncedPresenceRef.current = false
          setHasSyncedPresence(false)
        }
      })

    teamChannelRef.current = channel

    return () => {
      isUnmounting = true
      supabase.removeChannel(channel)
      if (teamChannelRef.current === channel) {
        teamChannelRef.current = null
      }
    }
  }, [teamId, presenceRefreshKey, supabase])

  // ── Postgres Changes for device list (INSERT/UPDATE/DELETE) ───────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('screens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices', filter: `team_id=eq.${teamId}` },
        (payload) => {
          try {
            if (payload.eventType === 'INSERT') {
              if (payload.new && payload.new.id) {
                const inserted = mapDevice(payload.new)
                setDevices((prev) => {
                  if (prev.some((d) => d.id === inserted.id)) return prev
                  return [inserted, ...prev]
                })
              }
            } else if (payload.eventType === 'UPDATE') {
              if (payload.new && payload.new.id) {
                setDevices((prev) =>
                  prev.map((d) => {
                    if (d.id === payload.new.id) {
                      // Merge payload.new into existing device to preserve non-updated columns
                      return mapDevice({ ...d, ...payload.new })
                    }
                    return d
                  })
                )
              }
            } else if (payload.eventType === 'DELETE') {
              if (payload.old && payload.old.id) {
                setDevices((prev) => prev.filter((d) => d.id !== payload.old.id))
              }
            }
          } catch (err) {
            console.error('[useDevicePresence] Error handling postgres_changes payload:', err, payload)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, supabase])

  // ── Polling fallback (Heartbeat check) ────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data, error } = await supabase
          .from('devices')
          .select('id, status, last_seen_at')
          .eq('team_id', teamId)
        
        if (!error && data) {
          setDevices(prev => {
            const updatesMap = new Map<string, { status: Device['status']; last_seen_at: string | null }>(
              (data as any[]).map((d) => [
                d.id,
                {
                  status: d.status as Device['status'],
                  last_seen_at: d.last_seen_at || null
                }
              ])
            )
            return prev.map(d => {
              const update = updatesMap.get(d.id)
              if (update) {
                return {
                  ...d,
                  status: update.status,
                  last_seen_at: update.last_seen_at,
                }
              }
              return d
            })
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [teamId, supabase])

  return {
    devices,
    setDevices,
    onlineDeviceIds,
    setPresenceRefreshKey,
    hasSyncedPresence,
    mapDevice
  }
}
