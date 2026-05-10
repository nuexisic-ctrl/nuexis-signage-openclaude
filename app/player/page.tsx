'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHardwareId } from '@/lib/utils/fingerprint'
import styles from './player.module.css'

type PlayerState = 'loading' | 'pairing' | 'paired' | 'expired'

const PAIRING_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000     // 30 seconds

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function generateCode(): string {
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  const code = 100000 + (array[0] % 900000)
  return code.toString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeChannel = any

export default function PlayerPage() {
  const [state, setState] = useState<PlayerState>('loading')
  const [code, setCode] = useState<string>('')
  const [remainingMs, setRemainingMs] = useState(PAIRING_DURATION_MS)

  const [contentType, setContentType] = useState<string | null>(null)
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useState<string>('Fit')
  const [orientation, setOrientation] = useState<number>(0)

  const deviceIdRef      = useRef<string | null>(null)
  const isPairedRef      = useRef(false)
  const teamIdRef        = useRef<string | null>(null)
  const timerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef       = useRef<RealtimeChannel>(null)
  const teamChannelRef   = useRef<RealtimeChannel>(null)
  const supabaseRef      = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    // ── Asset resolver ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function resolveAsset(client: any, assetId: string | null) {
      if (!assetId) {
        setAssetUrl(null)
        setMimeType(null)
        return
      }
      const { data: asset } = await client
        .from('assets')
        .select('file_path, mime_type')
        .eq('id', assetId)
        .single()

      if (asset) {
        const { data } = client.storage.from('workspace-media').getPublicUrl(asset.file_path)
        setAssetUrl(data.publicUrl)
        setMimeType(asset.mime_type)
      } else {
        setAssetUrl(null)
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

    // ── Heartbeat: updates last_seen_at + resyncs state ─────────────────
    async function sendHeartbeat(deviceId: string) {
      if (cancelled) return

      // Update last_seen_at
      await supabase
        .from('devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', deviceId)

      // Resync: re-fetch device state to recover from Realtime drops
      const { data: fresh } = await supabase
        .from('devices')
        .select('content_type, asset_id, scale_mode, orientation, team_id')
        .eq('id', deviceId)
        .single()

      if (fresh && !cancelled) {
        // If the device has been unpaired from the CMS, reload
        if (!fresh.team_id && isPairedRef.current) {
          window.location.reload()
          return
        }
        applyDeviceState(fresh)
      }
    }

    function startHeartbeat(deviceId: string) {
      // Clear any existing heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)

      // Fire immediately so the device shows 'online' right away
      sendHeartbeat(deviceId)

      // Then repeat every 30 seconds
      heartbeatRef.current = setInterval(() => {
        sendHeartbeat(deviceId)
      }, HEARTBEAT_INTERVAL_MS)
    }

    // ── Ping-Pong: respond to dashboard health checks ──────────────────
    function startPingListener(teamId: string, deviceId: string) {
      // Clean up any existing team channel
      if (teamChannelRef.current) {
        supabase.removeChannel(teamChannelRef.current)
      }

      console.log('[Player] Subscribing to team ping channel:', `team-status:${teamId}`)

      const teamChannel = supabase
        .channel(`team-status:${teamId}`)
        .on('broadcast', { event: 'PING' }, () => {
          console.log('[Player] PING received, sending PONG for device:', deviceId)
          teamChannel.send({
            type: 'broadcast',
            event: 'PONG',
            payload: { device_id: deviceId },
          })
        })
        .subscribe((status: string) => {
          console.log('[Player] Team ping channel status:', status)
        })

      teamChannelRef.current = teamChannel
    }

    // ── Main init ────────────────────────────────────────────────────────
    async function init() {
      const hardwareId = await getHardwareId()
      console.log('[Player] Hardware ID:', hardwareId)

      const { data: existing } = await supabase
        .from('devices')
        .select('*')
        .eq('hardware_id', hardwareId)
        .maybeSingle()

      if (cancelled) return

      let activeDevice = null
      let activeCode = ''
      let expiresAtMs = Date.now() + PAIRING_DURATION_MS

      if (existing) {
        if (existing.team_id) {
          // ── Already paired — go straight to content ──────────────────
          console.log('[Player] Found persistent paired device')
          deviceIdRef.current = existing.id
          isPairedRef.current = true
          teamIdRef.current = existing.team_id
          setState('paired')
          activeDevice = existing
          applyDeviceState(existing)
          startHeartbeat(existing.id)
          startPingListener(existing.team_id, existing.id)
        } else {
          // ── Unpaired — check expiry ──────────────────────────────────
          const existingExpiry = new Date(existing.expires_at).getTime()
          if (existingExpiry > Date.now()) {
            console.log('[Player] Resuming active pairing session')
            deviceIdRef.current = existing.id
            activeCode = existing.pairing_code
            expiresAtMs = existingExpiry
            setCode(activeCode)
            setState('pairing')
            activeDevice = existing
          } else {
            console.log('[Player] Session expired, resetting')
            activeCode = generateCode()
            expiresAtMs = Date.now() + PAIRING_DURATION_MS
            const { data: updated } = await supabase
              .from('devices')
              .update({
                pairing_code: activeCode,
                status: 'pairing',
                expires_at: new Date(expiresAtMs).toISOString()
              })
              .eq('id', existing.id)
              .select('id, expires_at')
              .single()

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
        const { data, error } = await supabase
          .from('devices')
          .insert({
            hardware_id: hardwareId,
            pairing_code: activeCode,
            status: 'pairing',
            expires_at: new Date(expiresAtMs).toISOString()
          })
          .select('id, expires_at')
          .single()

        if (!error && data && !cancelled) {
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
            event: 'UPDATE',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${activeDevice.id}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: { new: any }) => {
            console.log('[Player] Realtime UPDATE received:', payload.new)
            if (payload.new.team_id) {
              if (!isPairedRef.current) {
                console.log('[Player] Device claimed! Transitioning to paired state.')
                isPairedRef.current = true
                teamIdRef.current = payload.new.team_id
                setState('paired')
                clearTimeout(timerRef.current!)
                clearInterval(intervalRef.current!)
                startHeartbeat(activeDevice.id)
                startPingListener(payload.new.team_id, activeDevice.id)
              }
              applyDeviceState(payload.new)
            } else {
              console.log('[Player] Device unpaired! Reloading player.')
              window.location.reload()
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
            console.log('[Player] Device deleted! Reloading player.')
            window.location.reload()
          }
        )
        .subscribe((status: string) => {
          console.log('[Player] Realtime subscription status:', status)

          // ── Race condition fix ───────────────────────────────────────
          // Once the subscription is confirmed, re-fetch the device state
          // to catch any UPDATE events that fired between init() and now.
          if (status === 'SUBSCRIBED') {
            supabase
              .from('devices')
              .select('*')
              .eq('id', activeDevice.id)
              .single()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then(({ data: fresh }: { data: any }) => {
                if (!fresh || cancelled) return
                if (fresh.team_id && !isPairedRef.current) {
                  console.log('[Player] Race condition caught — device already claimed.')
                  isPairedRef.current = true
                  teamIdRef.current = fresh.team_id
                  setState('paired')
                  clearTimeout(timerRef.current!)
                  clearInterval(intervalRef.current!)
                  startHeartbeat(fresh.id)
                  startPingListener(fresh.team_id, fresh.id)
                  applyDeviceState(fresh)
                } else if (fresh.team_id && isPairedRef.current) {
                  // Already paired — just resync state
                  applyDeviceState(fresh)
                }
              })
          }
        })

      channelRef.current = channel
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current!)
      clearInterval(intervalRef.current!)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current)
      }
      if (teamChannelRef.current) {
        supabaseRef.current.removeChannel(teamChannelRef.current)
      }
    }
  }, [])

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
      if (mimeType?.startsWith('video/')) {
        content = (
          <video
            key={assetUrl}
            src={assetUrl}
            style={mediaStyle}
            loop
            autoPlay
            playsInline
            muted={true}
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
