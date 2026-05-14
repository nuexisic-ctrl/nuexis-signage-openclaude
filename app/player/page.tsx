'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHardwareId } from '@/lib/utils/fingerprint'
import { registerDevice, refreshDeviceCode, getDeviceState, unpairDevice, updateDeviceOrientation, incrementPlaytime } from './actions'
import styles from './player.module.css'

type PlayerState = 'loading' | 'pairing' | 'paired' | 'expired'

const PAIRING_DURATION_MS = 15 * 60 * 1000 // 15 minutes

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const array = new Uint32Array(6)
  window.crypto.getRandomValues(array)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[array[i] % chars.length]
  }
  return code
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeChannel = any

export default function PlayerPage() {
  const [state, setState] = useState<PlayerState>('loading')
  const [code, setCode] = useState<string>('')
  const [remainingMs, setRemainingMs] = useState(PAIRING_DURATION_MS)

  const [contentType, setContentType] = useState<string | null>(null)
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useState<string>('Fit')
  const [orientation, setOrientation] = useState<number>(0)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  // We need refs to latest state for the interval
  const stateRef = useRef(state)
  const assetUrlRef = useRef(assetUrl)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    assetUrlRef.current = assetUrl
  }, [assetUrl])

  useEffect(() => {
    // Playtime tracking interval
    const playtimeInterval = setInterval(() => {
      const hwId = hardwareIdRef.current
      const devId = deviceIdRef.current
      const secret = secretRef.current

      // If we are paired and actively showing an asset, increment playtime by 60 seconds
      if (stateRef.current === 'paired' && assetUrlRef.current && hwId && devId && secret) {
        incrementPlaytime(devId, hwId, secret, 60).catch(err => {
          console.error('[Player] Failed to track playtime', err)
        })
      }
    }, 60000) // every 60 seconds

    return () => clearInterval(playtimeInterval)
  }, [])

  const deviceIdRef      = useRef<string | null>(null)
  const hardwareIdRef    = useRef<string | null>(null)
  const secretRef        = useRef<string | null>(null)
  const isPairedRef      = useRef(false)
  const teamIdRef        = useRef<string | null>(null)
  const presenceKeyRef   = useRef<string>(crypto.randomUUID())
  const timerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef       = useRef<RealtimeChannel>(null)
  const teamChannelRef   = useRef<RealtimeChannel>(null)
  const supabaseRef      = useRef(createClient())

  useEffect(() => {
    // Cleanup previous blob URL when it changes or unmounts
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  useEffect(() => {
    const savedMute = localStorage.getItem('nuexis_player_muted')
    if (savedMute !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMuted(savedMute === 'true')
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    // ── Asset resolver ───────────────────────────────────────────────────
    async function cleanupOldCaches(currentUrlToKeep: string) {
      try {
        const cache = await caches.open('nuexis-media-cache');
        const keys = await cache.keys();
        
        for (const request of keys) {
          if (request.url !== currentUrlToKeep) {
            await cache.delete(request);
            console.log('[Player] Deleted old cached asset:', request.url);
          }
        }
      } catch (err) {
        console.error('Failed to clean up old caches', err);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function resolveAsset(client: any, assetId: string | null) {
      if (!assetId) {
        setAssetUrl(null)
        setBlobUrl(null)
        setMimeType(null)
        return
      }
      const { data: asset } = await client
        .from('assets')
        .select('file_path, mime_type')
        .eq('id', assetId)
        .single()

      if (asset) {
        if (asset.mime_type === 'application/x-widget-youtube') {
          setBlobUrl(null)
          setAssetUrl(asset.file_path)
          setMimeType(asset.mime_type)
          return
        }

        const { data } = client.storage.from('workspace-media').getPublicUrl(asset.file_path)
        const publicUrl = data.publicUrl
        
        try {
          const cache = await caches.open('nuexis-media-cache')
          let response = await cache.match(publicUrl)
          
          if (!response) {
            console.log('[Player] Downloading media for offline cache...')
            response = await fetch(publicUrl)
            if (response.ok) {
              await cache.put(publicUrl, response.clone())
            }
          } else {
            console.log('[Player] Playing media from offline cache!')
          }

          if (response && response.ok) {
            const blob = await response.blob()
            const localBlobUrl = URL.createObjectURL(blob)
            
            setBlobUrl(localBlobUrl)
            setAssetUrl(localBlobUrl) // We use the blob URL for rendering
            setMimeType(asset.mime_type)

            // Clean up other cached videos so we don't run out of storage
            cleanupOldCaches(publicUrl)
          } else {
            throw new Error('Failed to load media')
          }
        } catch (err) {
          console.error('[Player] Offline caching failed, falling back to network stream', err)
          setBlobUrl(null)
          setAssetUrl(publicUrl)
          setMimeType(asset.mime_type)
        }
      } else {
        setAssetUrl(null)
        setBlobUrl(null)
        setMimeType(null)
      }
    }

    // ── Apply device state to local React state ─────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyDeviceState(device: any) {
      setContentType(device.content_type)
      setScaleMode(device.scale_mode || 'Fit')
      setOrientation(device.orientation || 0)
      if (device.content_type === 'Asset') {
        resolveAsset(supabase, device.asset_id)
      }
    }

    // ── Presence: track this device as online ─────────────────────────────
    function startPresenceTracking(teamId: string, deviceId: string) {
      // Clean up any existing team channel
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabase.removeChannel(teamChannelRef.current)
      }

      console.log('[Player] Starting presence tracking for team:', teamId)

      const teamChannel = supabase
        .channel(`team-status:${teamId}`, {
          config: { presence: { key: `${deviceId}:${presenceKeyRef.current}` } },
        })
        .subscribe(async (status: string) => {
          console.log('[Player] Presence channel status:', status)
          if (status === 'SUBSCRIBED') {
            await teamChannel.track({
              device_id: deviceId,
              online_at: new Date().toISOString(),
            })
            console.log('[Player] Presence tracked for device:', deviceId)
          }
        })

      teamChannelRef.current = teamChannel
    }

    // ── Main init ────────────────────────────────────────────────────────
    async function init() {
      const hardwareId = await getHardwareId()
      hardwareIdRef.current = hardwareId
      console.log('[Player] Hardware ID:', hardwareId)

      const savedSecret = localStorage.getItem('nuexis_device_secret')
      
      const existing = await getDeviceState(hardwareId, savedSecret || undefined)

      if (cancelled) return

      let activeDevice = null
      let activeCode = ''
      let expiresAtMs = Date.now() + PAIRING_DURATION_MS

      if (existing) {
        secretRef.current = savedSecret
        if (existing.team_id) {
          // ── Already paired — go straight to content ──────────────────
          console.log('[Player] Found persistent paired device')
          deviceIdRef.current = existing.id
          isPairedRef.current = true
          teamIdRef.current = existing.team_id
          setState('paired')
          activeDevice = existing
          applyDeviceState(existing)
          startPresenceTracking(existing.team_id, existing.id)
        } else {
          // ── Unpaired — check expiry ──────────────────────────────────
          const existingExpiry = new Date(existing.expires_at).getTime()
          if (existingExpiry > Date.now() && existing.pairing_code) {
            console.log('[Player] Resuming active pairing session')
            deviceIdRef.current = existing.id
            activeCode = existing.pairing_code
            expiresAtMs = existingExpiry
            setCode(activeCode)
            setState('pairing')
            activeDevice = existing
          } else {
            console.log('[Player] Session expired or no code, resetting')
            activeCode = generateCode()
            expiresAtMs = Date.now() + PAIRING_DURATION_MS
            const updated = await refreshDeviceCode(existing.id, hardwareId, savedSecret!, activeCode, expiresAtMs).catch(() => null)

            if (updated && !cancelled) {
              deviceIdRef.current = updated.id
              setCode(activeCode)
              setState('pairing')
              activeDevice = updated
            }
          }
        }
      } else {
        // ── Brand new device — register ────────────────────────────────
        console.log('[Player] Initialising — generating new pairing code')
        activeCode = generateCode()
        expiresAtMs = Date.now() + PAIRING_DURATION_MS
        let data = null
        let error = null
        try {
          data = await registerDevice(hardwareId, activeCode, expiresAtMs)
        } catch (err) {
          error = err
        }

        if (!error && data && !cancelled) {
          if (data.secret) localStorage.setItem('nuexis_device_secret', data.secret)
          secretRef.current = data.secret
          deviceIdRef.current = data.id
          setCode(activeCode)
          setState('pairing')
          activeDevice = data
        } else if (error) {
          console.error('[Player] Failed to register device:', error)
          if (!cancelled) setState('expired')
          return
        }
      }

      if (cancelled || !activeDevice) return

      // ── Countdown timers (only while pairing) ──────────────────────────
      if (!isPairedRef.current) {
        const left = expiresAtMs - Date.now()
        setRemainingMs(left > 0 ? left : 0)

        intervalRef.current = setInterval(() => {
          const timeLeft = expiresAtMs - Date.now()
          setRemainingMs(timeLeft)
          
          if (timeLeft % 3000 < 1000) {
             const hwId = hardwareIdRef.current
             const sec = secretRef.current
             if (hwId && !isPairedRef.current) {
               getDeviceState(hwId, sec || undefined)
                 .then((fresh) => {
                   if (!fresh || cancelled) return
                   if (fresh.team_id && !isPairedRef.current) {
                     console.log('[Player] Polling caught — device claimed.')
                     isPairedRef.current = true
                     teamIdRef.current = fresh.team_id
                     setState('paired')
                     clearTimeout(timerRef.current!)
                     clearInterval(intervalRef.current!)
                     startPresenceTracking(fresh.team_id, fresh.id)
                     applyDeviceState(fresh)
                   }
                 })
                 .catch(console.error)
             }
          }

          if (timeLeft <= 0) clearInterval(intervalRef.current!)
        }, 1000)

        timerRef.current = setTimeout(() => {
          if (cancelled) return
          console.log('[Player] Code expired')
          setState('expired')
          clearInterval(intervalRef.current!)
        }, Math.max(0, expiresAtMs - Date.now()))
      }

      // ── Realtime subscription ──────────────────────────────────────────
      console.log('[Player] Setting up Realtime subscription for device', activeDevice.id)

      const channel = supabase
        .channel(`device-pair-${activeDevice.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${activeDevice.id}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: { new: any, eventType: string }) => {
            console.log(`[Player] Realtime ${payload.eventType} received:`, payload.new)
            if (payload.new && payload.new.team_id) {
              if (!isPairedRef.current) {
                console.log('[Player] Device claimed! Transitioning to paired state.')
                isPairedRef.current = true
                teamIdRef.current = payload.new.team_id
                setState('paired')
                clearTimeout(timerRef.current!)
                clearInterval(intervalRef.current!)
                startPresenceTracking(payload.new.team_id, activeDevice.id)
              }
              applyDeviceState(payload.new)
            } else {
              if (navigator.onLine) {
                console.log('[Player] Device unpaired! Reloading player.')
                window.location.reload()
              } else {
                console.log('[Player] Device unpaired but offline. Skipping reload.')
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${activeDevice.id}`,
          },
          () => {
            if (navigator.onLine) {
              console.log('[Player] Device deleted! Reloading player.')
              window.location.reload()
            }
          }
        )
        .subscribe((status: string) => {
          console.log('[Player] Realtime subscription status:', status)

          // ── Race condition fix ───────────────────────────────────────
          // Once the subscription is confirmed, re-fetch the device state
          // to catch any UPDATE events that fired between init() and now.
          if (status === 'SUBSCRIBED') {
            const hwId = hardwareIdRef.current
            const sec = secretRef.current
            if (hwId) {
              getDeviceState(hwId, sec || undefined)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((fresh: any) => {
                if (!fresh || cancelled) return
                if (fresh.team_id && !isPairedRef.current) {
                  console.log('[Player] Race condition caught — device already claimed.')
                  isPairedRef.current = true
                  teamIdRef.current = fresh.team_id
                  setState('paired')
                  clearTimeout(timerRef.current!)
                  clearInterval(intervalRef.current!)
                  startPresenceTracking(fresh.team_id, fresh.id)
                  applyDeviceState(fresh)
                } else if (fresh.team_id && isPairedRef.current) {
                  // Already paired — just resync state
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
      if (channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current)
      }
      if (teamChannelRef.current) {
        teamChannelRef.current.untrack()
        supabaseRef.current.removeChannel(teamChannelRef.current)
      }
    }
  }, [])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(err => console.error(err))
    } else {
      await document.exitFullscreen().catch(err => console.error(err))
    }
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    localStorage.setItem('nuexis_player_muted', next.toString())
  }

  const handleUnpair = async () => {
    if (confirm('Are you sure you want to unpair this device?')) {
      if (deviceIdRef.current && hardwareIdRef.current && secretRef.current) {
        await unpairDevice(deviceIdRef.current, hardwareIdRef.current, secretRef.current).catch(err => console.error(err))
        localStorage.removeItem('nuexis_device_secret')
      }
      window.location.reload()
    }
  }

  const handleOrientationChange = async (val: number) => {
    setOrientation(val)
    if (deviceIdRef.current && hardwareIdRef.current && secretRef.current) {
      await updateDeviceOrientation(deviceIdRef.current, hardwareIdRef.current, secretRef.current, val).catch(err => console.error(err))
    }
  }

  const progressPct = (remainingMs / PAIRING_DURATION_MS) * 100
  const isUrgent = remainingMs < 2 * 60 * 1000 // < 2 mins

  // ── Paired ──────────────────────────────────────────────────────────────────
  if (state === 'paired') {
    const objectFitMap: Record<string, 'none' | 'contain' | 'fill' | 'cover'> = {
      'None': 'none',
      'Fit': 'contain',
      'Stretch': 'fill',
      'Zoom': 'cover',
    }

    const fit = objectFitMap[scaleMode] || 'contain'

    const isRotated = orientation === 90 || orientation === 270

    const containerStyle: React.CSSProperties = {
      width: isRotated ? '100vh' : '100vw',
      height: isRotated ? '100vw' : '100vh',
      transform: `rotate(${orientation}deg)`,
      transformOrigin: 'center center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: isRotated ? '-50vh' : '-50vw',
      marginTop: isRotated ? '-50vw' : '-50vh',
      backgroundColor: '#000',
      overflow: 'hidden'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: fit,
    }

    let content = null
    if (contentType === 'Asset' && assetUrl) {
      if (mimeType === 'application/x-widget-youtube') {
        const videoId = assetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
        content = (
          <iframe 
            key={assetUrl}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0`}
            style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )
      } else if (mimeType?.startsWith('video/')) {
        content = (
          <video
            key={assetUrl}
            src={assetUrl}
            style={mediaStyle}
            loop
            autoPlay
            playsInline
            muted={isMuted}
          />
        )
      } else {
        content = (
          <img
            key={assetUrl}
            src={assetUrl}
            style={mediaStyle}
            alt="Assigned content"
          />
        )
      }
    } else {
      content = (
        <div className={styles.pairedFlash}>
          <svg className={styles.pairedIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={styles.pairedText}>Screen Connected. Waiting for content...</p>
        </div>
      )
    }

    return (
      <div className={styles.pairedView} style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>
        <div style={containerStyle}>
          {content}
        </div>

        <div className={styles.controlsOverlay}>
          <button className={styles.iconButton} onClick={toggleFullscreen} title="Toggle Fullscreen">
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9h4.5M9 15v4.5M9 15H4.5M15 15v4.5M15 15h4.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
          <button className={styles.iconButton} onClick={() => setIsSidebarOpen(true)} title="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {isSidebarOpen && (
          <>
            <div className={styles.sidebarBackdrop} onClick={() => setIsSidebarOpen(false)} />
            <div className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <h2>Nu<span>Exis</span></h2>
                <button className={styles.closeButton} onClick={() => setIsSidebarOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={styles.sidebarContent}>
                
                <div className={styles.menuItem}>
                  <span className={styles.menuItemLabel}>Device Actions</span>
                  <button className={styles.menuButton} onClick={() => window.location.reload()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Refresh
                  </button>
                  <button className={`${styles.menuButton} ${styles.danger}`} onClick={handleUnpair}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Unpair Device
                  </button>
                </div>

                <div className={styles.menuItem}>
                  <span className={styles.menuItemLabel}>Audio</span>
                  <button className={styles.menuButton} onClick={toggleMute}>
                    {isMuted ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L5.25 9v6h3.53l3.97 3.97v-13.94l-3.97 3.97z" />
                        </svg>
                        Unmute
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                        Mute
                      </>
                    )}
                  </button>
                </div>

                <div className={styles.menuItem}>
                  <span className={styles.menuItemLabel}>Orientation</span>
                  <select className={styles.menuSelect} value={orientation} onChange={(e) => handleOrientationChange(Number(e.target.value))}>
                    <option value={0}>0° (Landscape)</option>
                    <option value={90}>90° (Portrait CW)</option>
                    <option value={180}>180° (Landscape Flipped)</option>
                    <option value={270}>270° (Portrait CCW)</option>
                  </select>
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Expired ─────────────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <div className={styles.shell}>
        <div className={styles.expiredView}>
          <svg className={styles.expiredIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h1 className={styles.expiredTitle}>Pairing code expired</h1>
          <p className={styles.expiredText}>
            The 15-minute window has closed. Reload this page to generate a new code.
          </p>
          <button className={styles.reloadBtn} onClick={() => window.location.reload()}>
            Generate New Code
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingView}>
          <div className={styles.spinner} />
        </div>
      </div>
    )
  }

  // ── Pairing ─────────────────────────────────────────────────────────────────
  const digits = code.split('')

  return (
    <div className={styles.shell}>
      <div className={styles.pairingView}>
        <div className={styles.brand}>
          Nu<span>Exis</span>
        </div>

        <p className={styles.instructionLabel}>Pairing Code</p>

        <div className={styles.codeDisplay}>
          {digits.slice(0, 3).map((d, i) => (
            <div key={i} className={styles.codeDigit}>{d}</div>
          ))}
          <div className={styles.codeSep} />
          {digits.slice(3, 6).map((d, i) => (
            <div key={i + 3} className={styles.codeDigit}>{d}</div>
          ))}
        </div>

        <div className={styles.countdownRow}>
          <svg className={styles.countdownIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={styles.countdownText}>
            Code expires in{' '}
            <span className={`${styles.countdownTime} ${isUrgent ? styles.countdownUrgent : ''}`}>
              {formatTime(remainingMs)}
            </span>
          </span>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${isUrgent ? styles.progressFillUrgent : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className={styles.howTo}>
          <p className={styles.howToTitle}>
            Enter this code in your NuExis dashboard to pair this screen.
          </p>
          <span className={styles.howToPath}>
            Dashboard → Screens → Add Screen
          </span>
        </div>
      </div>
    </div>
  )
}
