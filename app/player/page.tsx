'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  const deviceIdRef  = useRef<string | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef   = useRef<RealtimeChannel>(null)
  const supabaseRef  = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    async function init() {
      console.log('[Player] Initialising — generating pairing code')
      const pairingCode = generateCode()

      const { data, error } = await supabase
        .from('devices')
        .insert({ pairing_code: pairingCode, status: 'pairing' })
        .select('id')
        .single()

      if (cancelled) return

      if (error || !data) {
        console.error('[Player] Failed to register device:', error)
        setState('expired')
        return
      }

      console.log('[Player] Device registered, id:', data.id, 'code:', pairingCode)
      deviceIdRef.current = data.id
      setCode(pairingCode)
      setState('pairing')

      // ── Countdown interval ────────────────────────────────────────────────
      const expiresAt = Date.now() + PAIRING_DURATION_MS
      intervalRef.current = setInterval(() => {
        const left = expiresAt - Date.now()
        setRemainingMs(left)
        if (left <= 0) clearInterval(intervalRef.current!)
      }, 1000)

      // ── Expiry timer ──────────────────────────────────────────────────────
      timerRef.current = setTimeout(async () => {
        if (cancelled) return
        console.log('[Player] Code expired — cleaning up device')
        setState('expired')
        clearInterval(intervalRef.current!)
        await supabase.from('devices').delete().eq('id', data.id)
      }, PAIRING_DURATION_MS)

      // ── Realtime subscription ─────────────────────────────────────────────
      console.log('[Player] Setting up Realtime subscription for device', data.id)

      const channel = supabase
        .channel(`device-pair-${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${data.id}`,
          },
          (payload: { new: { team_id: string | null } }) => {
            console.log('[Player] Realtime UPDATE received:', payload.new)
            if (payload.new.team_id) {
              console.log('[Player] Device claimed! Transitioning to paired state.')
              setState('paired')
              clearTimeout(timerRef.current!)
              clearInterval(intervalRef.current!)
            }
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
      // Only delete the device row if it was NOT successfully paired.
      // A paired device must persist in the database for the dashboard.
      setState((currentState) => {
        if (currentState !== 'paired' && deviceIdRef.current) {
          console.log('[Player] Unmount: cleaning up unclaimed device', deviceIdRef.current)
          supabaseRef.current
            .from('devices')
            .delete()
            .eq('id', deviceIdRef.current)
            .then(() => console.log('[Player] Unclaimed device cleaned up on unmount'))
        }
        return currentState
      })
    }
  }, [])

  const progressPct = (remainingMs / PAIRING_DURATION_MS) * 100
  const isUrgent = remainingMs < 2 * 60 * 1000 // < 2 mins

  // ── Paired ──────────────────────────────────────────────────────────────────
  if (state === 'paired') {
    return (
      <div className={styles.pairedView}>
        <div className={styles.pairedFlash}>
          <svg className={styles.pairedIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={styles.pairedText}>Screen Connected</p>
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
