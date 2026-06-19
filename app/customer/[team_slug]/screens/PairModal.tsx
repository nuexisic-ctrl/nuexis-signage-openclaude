import React, { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from './Modal.module.css'
import { claimDevice } from './actions'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'

export interface PairModalProps {
  teamSlug: string
  onClose: () => void
  onSuccess: (deviceId: string) => void
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await claimDevice(teamSlug, code, '')
      if (result.success) {
        onSuccess(result.deviceId || '')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Add Screen')}
      subtitle={t('Follow the instructions below to launch the player app and pair your screen.')}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label htmlFor="pairing-code" className={styles.label}>{t('Pairing Code')}</label>
          <input
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
    </Modal>
  )
}
