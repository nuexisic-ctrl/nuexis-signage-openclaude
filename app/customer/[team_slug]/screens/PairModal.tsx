import React, { useState, useEffect, useTransition, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import styles from './Modal.module.css'
import { claimDevice } from './actions'
import { useTranslation } from '@/lib/i18n'

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
  const { t } = useTranslation()
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
            <h2 id="modal-title" className={styles.modalTitle}>{t('Add Screen')}</h2>
            <p className={styles.modalSubtitle}>
              {t('Follow the instructions below to launch the player app and pair your screen.')}
            </p>
          </div>
          <button
            id="modal-close-btn"
            className={styles.modalClose}
            onClick={onClose}
            aria-label={t('Close modal')}
          >
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="pairing-code" className={styles.label}>{t('Pairing Code')}</label>
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
              {t('Open the NuExis player app on your screen to get your 6-digit pairing code. Choose a platform below to launch or download:')}
            </p>
            <div className={styles.platformGrid}>
              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🤖</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>{t('Android')}</div>
                  <div className={styles.platformStatus}>{t('Coming Soon')}</div>
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
                  <div className={styles.platformName}>{t('Web Player')}</div>
                  <div className={styles.platformStatusActive}>{t('Open Player ↗')}</div>
                </div>
              </a>

              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🪟</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>{t('Windows')}</div>
                  <div className={styles.platformStatus}>{t('Coming Soon')}</div>
                </div>
              </div>

              <div className={`${styles.platformCard} ${styles.platformCardComingSoon}`}>
                <div className={styles.platformIcon}>🍎</div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>{t('macOS')}</div>
                  <div className={styles.platformStatus}>{t('Coming Soon')}</div>
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
            {isPending ? t('Pairing…') : t('Pair Screen')}
          </button>
        </form>
      </div>
    </div>
  )
}
