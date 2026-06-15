'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Device } from './types'

const RELATIVE_TIME_TICK_MS = 60 * 1000
const DEVICE_SELECT_FIELDS =
  'id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds, scale_mode'

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
  const devicesRef = useRef<Device[]>(devices)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set())
  const [hasSyncedPresence, setHasSyncedPresence] = useState(false)
  const [presenceRefreshKey, setPresenceRefreshKey] = useState(0)
  const [, setNowMs] = useState(Date.now())

  const teamChannelRef = useRef<any>(null)
  const presenceKeyRef = useRef<string>('')
  const hasSyncedPresenceRef = useRef(false)
  const isInitialLoadRef = useRef(true)
  const isInitialSyncRef = useRef(true)

  // Sync state when initialDevices update (smart merge to prevent real-time state overwrites)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      setDevices(initialDevices)
      isInitialLoadRef.current = false
    } else {
      setDevices(prev => {
        const existingMap = new Map(prev.map(d => [d.id, d]))
        return initialDevices.map(initDev => {
          const existing = existingMap.get(initDev.id)
          if (!existing) return initDev
          
          // Preserve real-time status and last_seen_at
          return {
            ...initDev,
            status: existing.status,
            last_seen_at: existing.last_seen_at || initDev.last_seen_at
          }
        })
      })
    }
  }, [initialDevices])

  // Track devices in a ref to avoid stale closure or render phase side-effects
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  // Setup tick relative timestamps
  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), RELATIVE_TIME_TICK_MS)
    return () => clearInterval(intervalId)
  }, [])

  // Initialize presence key
  useEffect(() => {
    const saved = localStorage.getItem('nuexis_presence_key')
    if (saved) {
      presenceKeyRef.current = saved
    } else {
      const newKey = Math.random().toString(36).substring(2, 15)
      localStorage.setItem('nuexis_presence_key', newKey)
      presenceKeyRef.current = newKey
    }
  }, [])

  // ── Persistent presence channel ────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    let isUnmounting = false
    isInitialSyncRef.current = true
    hasSyncedPresenceRef.current = false
    setHasSyncedPresence(false)

    const channel = supabase
      .channel(`team-status:${teamId}`)
      .on('presence', { event: 'sync' }, () => {
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
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          if (isUnmounting) return
          console.warn(`[Dashboard] Presence channel ${status}. Auto-reconnecting...`)
          hasSyncedPresenceRef.current = false
          setHasSyncedPresence(false)
          isInitialSyncRef.current = true
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

  // Handle presence shifts (side-effects for online/offline transitions)
  useEffect(() => {
    if (!hasSyncedPresenceRef.current) return

    const currentDevices = devicesRef.current
    if (currentDevices.length === 0) return

    // 1. Detect devices that went offline (were online, now absent from presence)
    const leftIds = currentDevices
      .filter(d => d.status === 'online' && !onlineDeviceIds.has(d.id))
      .map(d => d.id)

    // 2. Detect devices that joined (were offline/pairing, now in presence)
    const joinedIds = currentDevices
      .filter(d => d.status !== 'online' && onlineDeviceIds.has(d.id))
      .map(d => d.id)

    if (leftIds.length === 0 && joinedIds.length === 0) {
      isInitialSyncRef.current = false
      return
    }

    const now = new Date().toISOString()

    // Frontend purely updates local state to 'offline' (removed database updateDeviceLastSeen call to fix Thundering Herd)
    setDevices(prev => prev.map(d => {
      if (leftIds.includes(d.id)) {
        const updatedLastSeen = isInitialSyncRef.current ? d.last_seen_at : now
        return { ...d, status: 'offline', last_seen_at: updatedLastSeen }
      }
      if (joinedIds.includes(d.id)) return { ...d, status: 'online' }
      return d
    }))

    isInitialSyncRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineDeviceIds])

  // ── Postgres Changes for device list (INSERT/UPDATE/DELETE) ───────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('screens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices', filter: `team_id=eq.${teamId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setDevices((prev) => [mapDevice(payload.new), ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((d) => {
                if (d.id === payload.new.id) {
                  const mappedNew = mapDevice(payload.new)
                  // Merge the update from Postgres but preserve frontend real-time presence status & last_seen_at
                  return {
                    ...d,
                    ...mappedNew,
                    status: d.status,
                    last_seen_at: d.status === 'online' ? d.last_seen_at : (mappedNew.last_seen_at || d.last_seen_at)
                  } as Device
                }
                return d
              })
            )
          } else if (payload.eventType === 'DELETE') {
            setDevices((prev) => prev.filter((d) => d.id !== payload.old.id))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'screen_groups', filter: `team_id=eq.${teamId}` },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'screen_group_members', filter: `team_id=eq.${teamId}` },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // ── Polling fallback (Heartbeat check) ────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Fetch only id, status, last_seen_at fields, and remove the .limit(1000) constraint
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
                const isOnline = onlineDeviceIds.has(d.id)
                return {
                  ...d,
                  status: isOnline ? 'online' : update.status,
                  last_seen_at: isOnline ? d.last_seen_at : update.last_seen_at,
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
  }, [teamId, onlineDeviceIds, supabase])

  return {
    devices,
    setDevices,
    onlineDeviceIds,
    setPresenceRefreshKey,
    hasSyncedPresence,
    mapDevice
  }
}
