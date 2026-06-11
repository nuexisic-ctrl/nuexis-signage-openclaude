'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateDeviceLastSeen } from './actions'
import { Device } from './types'

const RELATIVE_TIME_TICK_MS = 60 * 1000
const DEVICE_SELECT_FIELDS =
  'id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds'

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

  // Track if we have performed initial mount
  const isMountedRef = useRef(false)

  // Sync state when initialDevices update ONLY on initial mount
  // router.refresh() will cause this to fire again with potentially stale server cache data,
  // which causes UI flickering and reverts optimistic updates. Let Realtime be the source of truth.
  useEffect(() => {
    if (!isMountedRef.current) {
      setDevices(initialDevices)
      isMountedRef.current = true
    } else {
      // Merge only truly new devices that we might have missed via realtime
      setDevices(prev => {
        const existingIds = new Set(prev.map(d => d.id))
        const missingFromClient = initialDevices.filter(d => !existingIds.has(d.id))
        if (missingFromClient.length > 0) {
          return [...missingFromClient, ...prev]
        }
        return prev
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

    if (leftIds.length === 0 && joinedIds.length === 0) return

    const now = new Date().toISOString()

    // Safely fire side-effect here (in the useEffect body, not during the render/updater phase)
    if (leftIds.length > 0) {
      updateDeviceLastSeen(teamSlug, leftIds).catch(err =>
          console.error('[Dashboard] Error updating last seen:', err)
      )
    }

    setDevices(prev => prev.map(d => {
      if (leftIds.includes(d.id)) return { ...d, status: 'offline', last_seen_at: now }
      if (joinedIds.includes(d.id)) return { ...d, status: 'online' }
      return d
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineDeviceIds, teamSlug])

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
            setDevices((prev) => [payload.new as Device, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((d) => (d.id === payload.new.id ? { ...d, ...payload.new } as Device : d))
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
        const { data, error } = await supabase
          .from('devices')
          .select(DEVICE_SELECT_FIELDS)
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(1000)
        
        if (!error && data) {
          setDevices((data as any[]).map(mapDevice))
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  return {
    devices,
    setDevices,
    onlineDeviceIds,
    setPresenceRefreshKey,
    hasSyncedPresence,
    mapDevice
  }
}
