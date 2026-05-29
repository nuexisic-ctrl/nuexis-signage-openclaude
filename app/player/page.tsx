'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHardwareId } from '@/lib/utils/fingerprint'
import {
  registerDevice, refreshDeviceCode, getDeviceState,
  unpairDevice, updateDeviceOrientation, incrementPlaytime,
  sendHeartbeat, getSignedMediaUrl, getPlayerAsset,
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

  const [hardwareId, setHardwareId] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())

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
  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playtimeAccumulatorRef = useRef(0)
  const playtimeFlushCyclesRef = useRef(0)

  // ── Playtime flushing ───────────────────────────────────────────────
  const flushPlaytime = useCallback(async () => {
    const sec = playtimeAccumulatorRef.current
    if (sec <= 0) return

    const hwId = hardwareIdRef.current
    const devId = deviceIdRef.current
    const secret = secretRef.current

    if (devId && hwId && secret) {
      playtimeAccumulatorRef.current = 0
      try {
        await incrementPlaytime(devId, hwId, secret, sec)
      } catch (err: any) {
        playtimeAccumulatorRef.current += sec
        console.warn('[Player] Playtime increment deferred:', err.message || err)
      }
    }
  }, [])

  // ── Playtime & heartbeat tracking ───────────────────────────────────
  useEffect(() => {
    const playtimeInterval = setInterval(() => {
      const hwId = hardwareIdRef.current
      const devId = deviceIdRef.current
      const secret = secretRef.current

      if (stateRef.current === 'paired' && assetUrlRef.current && hwId && devId && secret) {
        playtimeAccumulatorRef.current += 60
        playtimeFlushCyclesRef.current += 1

        if (playtimeFlushCyclesRef.current >= 15) {
          playtimeFlushCyclesRef.current = 0
          flushPlaytime()
        }
      }

      if (stateRef.current === 'paired' && teamChannelRef.current && devId) {
        const tId = teamIdRef.current
        if (tId && hwId && secret) {
          sendHeartbeat(devId, tId, hwId, secret).catch((err: any) => {
            console.warn('[Player] Heartbeat deferred (transient network or extension override):', err.message || err)
          })
        }
      }
    }, 60000)

    return () => clearInterval(playtimeInterval)
  }, [flushPlaytime])

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
      } else if (document.visibilityState === 'hidden') {
        flushPlaytime()
      }
    }

    const handleFocusOrActivity = () => {
      if (document.visibilityState === 'visible' && deviceIdRef.current && teamIdRef.current) {
        reconnectPresenceRef.current?.()
      }
    }

    const handleUnload = () => {
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
      }
      flushPlaytime()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocusOrActivity)
    window.addEventListener('click', handleFocusOrActivity)
    window.addEventListener('mousedown', handleFocusOrActivity)
    window.addEventListener('keydown', handleFocusOrActivity)
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('unload', handleUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocusOrActivity)
      window.removeEventListener('click', handleFocusOrActivity)
      window.removeEventListener('mousedown', handleFocusOrActivity)
      window.removeEventListener('keydown', handleFocusOrActivity)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('unload', handleUnload)
      if (pollingIntervalRef.current) clearTimeout(pollingIntervalRef.current)
    }
  }, [flushPlaytime])

  useEffect(() => {
    let cancelled = false
    let currentAssetId: string | null = null

    const clearAsset = () => {
      setAssetUrl(null)
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setMimeType(null)
    }

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
      currentAssetId = assetId
      if (!assetId) {
        clearAsset()
        return
      }

      try {
        const asset = await getPlayerAsset(assetId, hardwareIdRef.current!, secretRef.current!)
        if (currentAssetId !== assetId || cancelled) return

        if (!asset) {
          clearAsset()
          return
        }

        if (
          asset.mime_type === 'application/x-widget-youtube' || 
          asset.mime_type === 'application/x-widget-remote-url' ||
          asset.mime_type === 'application/x-widget-html' ||
          asset.mime_type === 'application/x-widget-flow'
        ) {
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
          })
          setAssetUrl(asset.file_path)
          setMimeType(asset.mime_type)
          return
        }

        const cacheKey = `https://local-media-cache/${asset.file_path}`

        try {
          const cache = await caches.open('nuexis-media-cache')
          let response = await cache.match(cacheKey)

          if (currentAssetId !== assetId || cancelled) return

          if (!response) {
            const mediaUrl = await getSignedMediaUrl(asset.file_path, hardwareIdRef.current!, secretRef.current!)
            if (currentAssetId !== assetId || cancelled) return
            response = await fetch(mediaUrl, { mode: 'cors' })
            if (response.ok) {
              await cache.put(cacheKey, response.clone())
            }
          }

          if (currentAssetId !== assetId || cancelled) return

          if (response?.ok) {
            const blob = await response.blob()
            if (currentAssetId !== assetId || cancelled) return
            const localBlobUrl = URL.createObjectURL(blob)
            setBlobUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return localBlobUrl
            })
            setAssetUrl(localBlobUrl)
            setMimeType(asset.mime_type)
            cleanupOldCaches(cacheKey)
          } else {
            throw new Error('Failed to load media')
          }
        } catch {
          if (currentAssetId !== assetId || cancelled) return
          const mediaUrl = await getSignedMediaUrl(asset.file_path, hardwareIdRef.current!, secretRef.current!).catch(() => null)
          if (currentAssetId !== assetId || cancelled) return
          if (mediaUrl) {
            setBlobUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
            setAssetUrl(mediaUrl)
            setMimeType(asset.mime_type)
          }
        }
      } catch (err) {
        console.error('Failed to resolve asset in player:', err)
        clearAsset()
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
        clearAsset()
        setPlaylistId(device.playlist_id)
      } else {
        clearAsset()
        setPlaylistId(null)
      }
    }

    function startPresenceTracking(teamId: string, deviceId: string) {
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabase.removeChannel(teamChannelRef.current)
      }

      let isUnmounting = false;

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
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            if (!isUnmounting && !cancelled) {
              console.warn('[Player] Presence channel closed, reconnecting...')
              setTimeout(() => reconnectPresenceRef.current?.(), 3000)
            }
          }
        })

      teamChannelRef.current = teamChannel
      reconnectPresenceRef.current = () => {
        if (teamIdRef.current && deviceIdRef.current) {
          isUnmounting = true;
          startPresenceTracking(teamIdRef.current, deviceIdRef.current)
        }
      }
    }

    function startStatePolling() {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }

      const poll = async () => {
        const hwId = hardwareIdRef.current
        const sec = secretRef.current
        if (!hwId) return

        try {
          const fresh = await getDeviceState(hwId, sec || undefined)
          if (fresh) {
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
          }
        } catch (err) {
          console.error('[Player] Polling error:', err)
        }

        // Schedule next fallback poll: 5 minutes base + randomized jitter (+/- 15s)
        const nextDelay = 300000 + (Math.random() * 30 - 15) * 1000
        pollingIntervalRef.current = setTimeout(poll, Math.max(10000, nextDelay))
      }

      // Schedule first fallback poll
      const initialDelay = 300000 + (Math.random() * 30 - 15) * 1000
      pollingIntervalRef.current = setTimeout(poll, Math.max(10000, initialDelay))
    }

    async function init() {
      const hardwareId = window.Android ? window.Android.getNativeHardwareId() : await getHardwareId()
      hardwareIdRef.current = hardwareId
      setHardwareId(hardwareId)

      const savedSecret = window.Android ? window.Android.getNativeSecret() : localStorage.getItem('nuexis_device_secret')
      const existing = await getDeviceState(hardwareId, savedSecret || undefined)

      if (cancelled) return

      let activeDevice: DeviceState | null = null
      let activeCode = ''
      let expiresAtMs = Date.now() + PAIRING_DURATION_MS

      if (existing) {
        secretRef.current = savedSecret
        setSecret(savedSecret)
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
          setSecret(data.secret)
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
            // Stop state polling once realtime is subscribed for paired devices (H-18)
            if (pollingIntervalRef.current) {
              clearTimeout(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }

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
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            // Resume state polling if realtime fails (H-18)
            startStatePolling()
          }
        })

      channelRef.current = channel
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current!)
      clearInterval(intervalRef.current!)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabase.removeChannel(teamChannelRef.current)
      }
    }
  }, [supabase])

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
  const rootStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    position: 'fixed',
    top: 0, left: 0,
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
        hardwareId={hardwareId!}
        secret={secret!}
        supabase={supabase}
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
