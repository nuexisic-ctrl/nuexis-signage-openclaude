'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHardwareId } from '@/lib/utils/fingerprint'
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
  // Use Web Crypto API for cryptographically secure random numbers
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

  const deviceIdRef  = useRef<string | null>(null)
  const isPairedRef  = useRef(false)           // tracks paired status for safe cleanup
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef   = useRef<RealtimeChannel>(null)
  const supabaseRef  = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

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

    async function init() {
      const hardwareId = await getHardwareId()
      console.log('[Player] Hardware ID:', hardwareId)

      const { data: existing, error: fetchErr } = await supabase
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
          console.log('[Player] Found persistent paired device')
          deviceIdRef.current = existing.id
          isPairedRef.current = true
          setState('paired')
          activeDevice = existing

          setContentType(existing.content_type)
          setScaleMode(existing.scale_mode || 'Fit')
          setOrientation(existing.orientation || 0)
          if (existing.content_type === 'Asset') {
            resolveAsset(supabase, existing.asset_id)
          }
        } else {
          // Unpaired - check expiry
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

      // Only set up timers if we are still pairing
      if (!isPairedRef.current) {
        const left = expiresAtMs - Date.now()
        setRemainingMs(left > 0 ? left : 0)

        // Countdown interval
        intervalRef.current = setInterval(() => {
          const timeLeft = expiresAtMs - Date.now()
          setRemainingMs(timeLeft)
          if (timeLeft <= 0) clearInterval(intervalRef.current!)
        }, 1000)

        // Expiry timer
        timerRef.current = setTimeout(() => {
          if (cancelled) return
          console.log('[Player] Code expired')
          setState('expired')
          clearInterval(intervalRef.current!)
          // We rely on pg_cron to clean up the DB row, no need to delete here
        }, Math.max(0, expiresAtMs - Date.now()))
      }

      // Realtime subscription (watch for team_id assignment or unpairing)
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
                setState('paired')
                clearTimeout(timerRef.current!)
                clearInterval(intervalRef.current!)
              }
              setContentType(payload.new.content_type)
              setScaleMode(payload.new.scale_mode || 'Fit')
              setOrientation(payload.new.orientation || 0)
              resolveAsset(supabase, payload.new.asset_id)
            } else {
              console.log('[Player] Device unpaired! Reloading player.')
              window.location.reload()
            }
          }
        )
        // Also watch for DELETE to handle dashboard removals
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
      // Note: We no longer delete the row on unmount.
      // This allows the device pairing session to persist across page refreshes.
      // Stale rows are cleaned up automatically via pg_cron.
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

    const containerStyle: React.CSSProperties = {
      width: (orientation === 90 || orientation === 270) ? '100vh' : '100vw',
      height: (orientation === 90 || orientation === 270) ? '100vw' : '100vh',
      transform: `rotate(${orientation}deg)`,
      transformOrigin: 'center center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: (orientation === 90 || orientation === 270) ? '-50vh' : '-50vw',
      marginTop: (orientation === 90 || orientation === 270) ? '-50vw' : '-50vh',
      backgroundColor: '#000',
      overflow: 'hidden'
    }

    const mediaStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: fit as any,
    }

    let content = null
    if (contentType === 'Asset' && assetUrl) {
      if (mimeType?.startsWith('video/')) {
        content = (
          <video 
            src={assetUrl} 
            style={mediaStyle} 
            loop 
            autoPlay 
            playsInline 
            muted={false} 
          />
        )
      } else {
        content = (
          <img 
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
