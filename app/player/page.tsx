'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHardwareId } from '@/lib/utils/fingerprint'
import {
  registerDevice, refreshDeviceCode, getDeviceState,
  unpairDevice, updateDeviceOrientation, incrementPlaytime,
  sendHeartbeat, getSignedMediaUrl,
} from './actions'
import PairingView from './PairingView'
import PairedView from './PairedView'
import { ExpiredView, LoadingView } from './StatusViews'
import { PAIRING_DURATION_MS, generateCode } from './types'
import type { PlayerState, DeviceState, RealtimeChannel } from './types'

export default function PlayerPage() {
  const [state, setState] = useState<PlayerState>('loading')
  const [code, setCode] = useState<string>('')
  const [remainingMs, setRemainingMs] = useState(PAIRING_DURATION_MS)

  const [contentType, setContentType] = useState<string | null>(null)
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useState<string>('Fit')
  const [orientation, setOrientation] = useState<number>(0)
  const [isMuted, setIsMuted] = useState(true)

  // Refs for latest state access in intervals
  const stateRef = useRef(state)
  const assetUrlRef = useRef(assetUrl)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { assetUrlRef.current = assetUrl }, [assetUrl])

  const deviceIdRef      = useRef<string | null>(null)
  const hardwareIdRef    = useRef<string | null>(null)
  const secretRef        = useRef<string | null>(null)
  const isPairedRef      = useRef(false)
  const teamIdRef        = useRef<string | null>(null)
  const presenceKeyRef   = useRef<string>('')
  const timerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef       = useRef<RealtimeChannel>(null)
  const teamChannelRef   = useRef<RealtimeChannel>(null)
  const reconnectPresenceRef = useRef<(() => void) | null>(null)
  const supabaseRef      = useRef(createClient())
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Playtime & heartbeat tracking ───────────────────────────────────
  useEffect(() => {
    const playtimeInterval = setInterval(() => {
      const hwId = hardwareIdRef.current
      const devId = deviceIdRef.current
      const secret = secretRef.current

      if (stateRef.current === 'paired' && assetUrlRef.current && hwId && devId && secret) {
        incrementPlaytime(devId, hwId, secret, 60).catch(console.error)
      }

      if (stateRef.current === 'paired' && teamChannelRef.current && devId) {
        const tId = teamIdRef.current
        teamChannelRef.current.track({
          device_id: devId,
          online_at: new Date().toISOString(),
        }).catch((err: unknown) => {
          console.error('[Player] Failed to re-track presence:', err)
          reconnectPresenceRef.current?.()
        })

        if (tId) {
          sendHeartbeat(devId, tId).catch(console.error)
        }
      }
    }, 60000)

    return () => clearInterval(playtimeInterval)
  }, [])

  // ── Presence key init ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('nuexis_presence_key')
    if (saved) {
      presenceKeyRef.current = saved
    } else {
      const newKey = crypto.randomUUID?.() ||
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      localStorage.setItem('nuexis_presence_key', newKey)
      presenceKeyRef.current = newKey
    }
  }, [])

  // ── Blob URL cleanup ────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  // ── Mute persistence & fullscreen listener ──────────────────────────
  useEffect(() => {
    const savedMute = localStorage.getItem('nuexis_player_muted')
    if (savedMute !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMuted(savedMute === 'true')
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && deviceIdRef.current && teamIdRef.current) {
        reconnectPresenceRef.current?.()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [])

  // ── Main init effect ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    async function cleanupOldCaches(currentUrlToKeep: string) {
      try {
        const cache = await caches.open('nuexis-media-cache')
        const keys = await cache.keys()
        for (const request of keys) {
          if (request.url !== currentUrlToKeep) {
            await cache.delete(request)
          }
        }
      } catch (err) {
        console.error('Failed to clean up old caches', err)
      }
    }

    async function resolveAsset(client: typeof supabase, assetId: string | null) {
      if (!assetId) {
        setAssetUrl(null); setBlobUrl(null); setMimeType(null)
        return
      }
      const { data: asset } = await client
        .from('assets')
        .select('file_path, mime_type')
        .eq('id', assetId)
        .single()

      if (!asset) {
        setAssetUrl(null); setBlobUrl(null); setMimeType(null)
        return
      }

      if (asset.mime_type === 'application/x-widget-youtube' || asset.mime_type === 'application/x-widget-remote-url') {
        setBlobUrl(null); setAssetUrl(asset.file_path); setMimeType(asset.mime_type)
        return
      }

      const mediaUrl = await getSignedMediaUrl(asset.file_path)

      try {
        const cache = await caches.open('nuexis-media-cache')
        let response = await cache.match(mediaUrl)

        if (!response) {
          response = await fetch(mediaUrl, { mode: 'cors' })
          if (response.ok) await cache.put(mediaUrl, response.clone())
        }

        if (response?.ok) {
          const blob = await response.blob()
          const localBlobUrl = URL.createObjectURL(blob)
          setBlobUrl(localBlobUrl)
          setAssetUrl(localBlobUrl)
          setMimeType(asset.mime_type)
          cleanupOldCaches(mediaUrl)
        } else {
          throw new Error('Failed to load media')
        }
      } catch {
        setBlobUrl(null); setAssetUrl(mediaUrl); setMimeType(asset.mime_type)
      }
    }

    function applyDeviceState(device: DeviceState) {
      setContentType(device.content_type)
      setScaleMode(localStorage.getItem(`scale_mode_${device.id}`) || 'Fit')
      setOrientation(device.orientation || 0)
      if (device.content_type === 'Asset') {
        setPlaylistId(null)
        resolveAsset(supabase, device.asset_id)
      } else if (device.content_type === 'Playlist') {
        setAssetUrl(null); setBlobUrl(null); setMimeType(null)
        setPlaylistId(device.playlist_id)
      } else {
        setAssetUrl(null); setBlobUrl(null); setMimeType(null); setPlaylistId(null)
      }
    }

    function startPresenceTracking(teamId: string, deviceId: string) {
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabase.removeChannel(teamChannelRef.current)
      }

      const teamChannel = supabase
        .channel(`team-status:${teamId}`, {
          config: { presence: { key: `${deviceId}:${presenceKeyRef.current}` } },
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await teamChannel.track({
              device_id: deviceId,
              online_at: new Date().toISOString(),
            })
          }
        })

      teamChannelRef.current = teamChannel
      reconnectPresenceRef.current = () => {
        if (teamIdRef.current && deviceIdRef.current) {
          startPresenceTracking(teamIdRef.current, deviceIdRef.current)
        }
      }
    }

    function startStatePolling() {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

      pollingIntervalRef.current = setInterval(async () => {
        const hwId = hardwareIdRef.current
        const sec = secretRef.current
        if (!hwId) return

        try {
          const fresh = await getDeviceState(hwId, sec || undefined)
          if (!fresh) return

          if (fresh.team_id && !isPairedRef.current) {
            isPairedRef.current = true
            teamIdRef.current = fresh.team_id
            setState('paired')
            if (timerRef.current) clearTimeout(timerRef.current)
            if (intervalRef.current) clearInterval(intervalRef.current)
            startPresenceTracking(fresh.team_id, fresh.id)
          }

          if (!fresh.team_id && isPairedRef.current) {
            window.location.assign(window.location.pathname)
            return
          }

          applyDeviceState(fresh)
        } catch (err) {
          console.error('[Player] Polling error:', err)
        }
      }, 5000)
    }

    async function init() {
      const hardwareId = window.Android ? window.Android.getNativeHardwareId() : await getHardwareId()
      hardwareIdRef.current = hardwareId

      const savedSecret = window.Android ? window.Android.getNativeSecret() : localStorage.getItem('nuexis_device_secret')
      const existing = await getDeviceState(hardwareId, savedSecret || undefined)

      if (cancelled) return

      let activeDevice: DeviceState | null = null
      let activeCode = ''
      let expiresAtMs = Date.now() + PAIRING_DURATION_MS

      if (existing) {
        secretRef.current = savedSecret
        if (existing.team_id) {
          deviceIdRef.current = existing.id
          isPairedRef.current = true
          teamIdRef.current = existing.team_id
          setState('paired')
          activeDevice = existing
          applyDeviceState(existing)
          startPresenceTracking(existing.team_id, existing.id)
          startStatePolling()
        } else {
          const existingExpiry = new Date(existing.expires_at).getTime()
          if (existingExpiry > Date.now() && existing.pairing_code) {
            deviceIdRef.current = existing.id
            activeCode = existing.pairing_code
            expiresAtMs = existingExpiry
            setCode(activeCode)
            setState('pairing')
            activeDevice = existing
          } else {
            activeCode = generateCode()
            expiresAtMs = Date.now() + PAIRING_DURATION_MS
            const updated = await refreshDeviceCode(existing.id, hardwareId, savedSecret!, activeCode, expiresAtMs).catch(() => null)
            if (updated && !cancelled) {
              deviceIdRef.current = updated.id
              setCode(activeCode)
              setState('pairing')
              activeDevice = updated as unknown as DeviceState
              startStatePolling()
            }
          }
        }
      } else {
        activeCode = generateCode()
        expiresAtMs = Date.now() + PAIRING_DURATION_MS
        let data = null
        try { data = await registerDevice(hardwareId, activeCode, expiresAtMs) } catch {}

        if (data && !cancelled) {
          if (data.secret) {
            if (window.Android) window.Android.setNativeSecret(data.secret)
            else localStorage.setItem('nuexis_device_secret', data.secret)
          }
          secretRef.current = data.secret
          deviceIdRef.current = data.id
          setCode(activeCode)
          setState('pairing')
          activeDevice = data as unknown as DeviceState
        } else {
          if (!cancelled) setState('expired')
          return
        }
      }

      if (cancelled || !activeDevice) return
      if (!existing && activeDevice) startStatePolling()

      // ── Countdown timer ───────────────────────────────────────────
      if (!isPairedRef.current) {
        const left = expiresAtMs - Date.now()
        setRemainingMs(left > 0 ? left : 0)

        intervalRef.current = setInterval(() => {
          const timeLeft = expiresAtMs - Date.now()
          setRemainingMs(timeLeft)
          if (timeLeft <= 0) clearInterval(intervalRef.current!)
        }, 1000)

        timerRef.current = setTimeout(() => {
          if (!cancelled) {
            setState('expired')
            clearInterval(intervalRef.current!)
          }
        }, Math.max(0, expiresAtMs - Date.now()))
      }

      // ── Realtime subscription ─────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channel = (supabase as any)
        .channel(`device-pair-${activeDevice.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'devices', filter: `id=eq.${activeDevice.id}` },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            if (payload.new?.team_id) {
              if (!isPairedRef.current) {
                isPairedRef.current = true
                teamIdRef.current = payload.new.team_id
                setState('paired')
                clearTimeout(timerRef.current!)
                clearInterval(intervalRef.current!)
                startPresenceTracking(payload.new.team_id, activeDevice!.id)
              }
              applyDeviceState(payload.new)
            } else {
              if (navigator.onLine) window.location.assign(window.location.pathname)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'devices', filter: `id=eq.${activeDevice.id}` },
          () => { if (navigator.onLine) window.location.assign(window.location.pathname) }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            const hwId = hardwareIdRef.current
            const sec = secretRef.current
            if (hwId) {
              getDeviceState(hwId, sec || undefined)
                .then((fresh) => {
                  if (!fresh || cancelled) return
                  if (fresh.team_id && !isPairedRef.current) {
                    isPairedRef.current = true
                    teamIdRef.current = fresh.team_id
                    setState('paired')
                    clearTimeout(timerRef.current!)
                    clearInterval(intervalRef.current!)
                    startPresenceTracking(fresh.team_id, fresh.id)
                    applyDeviceState(fresh)
                  } else if (fresh.team_id && isPairedRef.current) {
                    applyDeviceState(fresh)
                  }
                })
                .catch(console.error)
            }
          }
        })

      channelRef.current = channel
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current!)
      clearInterval(intervalRef.current!)
      if (channelRef.current) supabaseRef.current.removeChannel(channelRef.current)
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabaseRef.current.removeChannel(teamChannelRef.current)
      }
    }
  }, [])

  // ── Event handlers ──────────────────────────────────────────────────
  const handleUnpair = async () => {
    if (confirm('Are you sure you want to unpair this device?')) {
      if (deviceIdRef.current && hardwareIdRef.current && secretRef.current) {
        await unpairDevice(deviceIdRef.current, hardwareIdRef.current, secretRef.current).catch(console.error)
        if (window.Android) window.Android.clearNativeSecret()
        else localStorage.removeItem('nuexis_device_secret')
      }
      window.location.assign(window.location.pathname)
    }
  }

  const handleOrientationChange = async (val: number) => {
    setOrientation(val)
    if (deviceIdRef.current && hardwareIdRef.current && secretRef.current) {
      await updateDeviceOrientation(deviceIdRef.current, hardwareIdRef.current, secretRef.current, val).catch(console.error)
    }
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    localStorage.setItem('nuexis_player_muted', next.toString())
  }

  // ── Render ──────────────────────────────────────────────────────────
  const isRotated = orientation === 90 || orientation === 270

  const rootStyle: React.CSSProperties = {
    width: isRotated ? '100vh' : '100vw',
    height: isRotated ? '100vw' : '100vh',
    transform: `rotate(${orientation}deg)`,
    transformOrigin: 'center center',
    position: 'fixed',
    top: '50%', left: '50%',
    marginLeft: isRotated ? '-50vh' : '-50vw',
    marginTop: isRotated ? '-50vw' : '-50vh',
    overflow: 'hidden',
    backgroundColor: '#07111f',
  }

  let currentView = null

  if (state === 'paired') {
    currentView = (
      <PairedView
        contentType={contentType}
        assetUrl={assetUrl}
        mimeType={mimeType}
        playlistId={playlistId}
        scaleMode={scaleMode}
        isMuted={isMuted}
        orientation={orientation}
        supabase={supabaseRef.current}
        onUnpair={handleUnpair}
        onOrientationChange={handleOrientationChange}
        onMuteToggle={toggleMute}
      />
    )
  } else if (state === 'expired') {
    currentView = <ExpiredView />
  } else if (state === 'loading') {
    currentView = <LoadingView />
  } else {
    currentView = (
      <PairingView
        code={code}
        remainingMs={remainingMs}
        pairingDurationMs={PAIRING_DURATION_MS}
      />
    )
  }

  return (
    <div style={rootStyle}>
      {currentView}
    </div>
  )
}
