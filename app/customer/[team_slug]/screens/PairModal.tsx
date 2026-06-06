import React, { useState, useEffect, useTransition, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import styles from './Modal.module.css'
import { claimDevice } from './actions'

export interface PairModalProps {
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function PairModal({
  teamSlug,
  onClose,
  onSuccess,
}: PairModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Small timeout ensures it runs after modal mount and animation transitions commit
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await claimDevice(teamSlug, code, '')
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      id="pair-modal-overlay"
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-title" className={styles.modalTitle}>Add Screen</h2>
            <p className={styles.modalSubtitle}>
              Follow the instructions below to launch the player app and pair your screen.
            </p>
          </div>
          <button
            id="modal-close-btn"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="pairing-code" className={styles.label}>Pairing Code</label>
            <input
              ref={inputRef}
              id="pairing-code"
              className={styles.codeInput}
              type="text"
              inputMode="text"
              placeholder="A1B2C3"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
                setCode(val)
              }}
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className={styles.instructionSection}>
            <p className={styles.instructionText}>
              Open the NuExis player app on your screen to get your 6-digit pairing code. Choose a platform below to launch or download:
            </p>
            <div className={styles.platformGrid}>
              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🤖</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>Android</div>
                  <div className={styles.platformStatus}>Coming Soon</div>
                </div>
              </div>

              <a 
                href="/player" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`${styles.platformCard} ${styles.platformCardActive}`}
              >
                <div className={styles.platformIcon}>🌐</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>Web Player</div>
                  <div className={styles.platformStatusActive}>Open Player ↗</div>
                </div>
              </a>

              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🪟</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>Windows</div>
                  <div className={styles.platformStatus}>Coming Soon</div>
                </div>
              </div>

              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🍎</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>macOS</div>
                  <div className={styles.platformStatus}>Coming Soon</div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorMsg} role="alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <button
            id="pair-submit-btn"
            className={styles.submitBtn}
            type="submit"
            disabled={isPending || code.length !== 6}
          >
            {isPending ? 'Pairing…' : 'Pair Screen'}
          </button>
        </form>
      </div>
    </div>
  )
}
