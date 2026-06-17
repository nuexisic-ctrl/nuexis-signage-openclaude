'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Check, Monitor, X } from 'lucide-react'
import { modalStack } from '@/lib/utils/modalStack'
import { pushAssetToScreen } from './actions'
import { Asset, ScreenDevice } from './types'
import styles from './PushToScreenModal.module.css'
import { useTranslation } from '@/lib/i18n'

interface PushToScreenModalProps {
  asset: Asset
  screens: ScreenDevice[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function PushToScreenModal({
  asset,
  screens,
  teamSlug,
  onClose,
  onSuccess,
}: PushToScreenModalProps) {
  const { t } = useTranslation()
  const [selectedScreenId, setSelectedScreenId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedScreen = useMemo(
    () => screens.find(screen => screen.id === selectedScreenId),
    [screens, selectedScreenId]
  )

  function getScreenStatusLabel(status: ScreenDevice['status']) {
    if (status === 'online') return t('Online')
    if (status === 'pairing') return t('Pairing')
    return t('Offline')
  }

  useEffect(() => {
    modalStack.push('push-to-screen-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('push-to-screen-modal')
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalStack.isTop('push-to-screen-modal')) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handlePush() {
    if (!selectedScreenId || isPending) return

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await pushAssetToScreen(teamSlug, selectedScreenId, asset.id)
      if (!result.success) {
        setError(result.error || t('Failed to push asset to screen.'))
        return
      }

      setSuccess(t('Pushed to {name}.', { name: selectedScreen?.name || t('selected screen') }))
      window.setTimeout(onSuccess, 700)
    })
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-to-screen-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconWrap}>
              <Monitor size={20} />
            </div>
            <div>
              <h2 id="push-to-screen-title" className={styles.title}>{t('Push to screen')}</h2>
              <p className={styles.subtitle} title={asset.file_name}>{asset.file_name}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('Close')}>
            <X size={18} />
          </button>
        </header>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.successBanner} role="status">
            <Check size={16} />
            <span>{success}</span>
          </div>
        )}

        <div className={styles.tableContainer}>
          <table className={styles.screensTable}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: '52px' }}></th>
                <th>{t('Screen')}</th>
                <th>{t('Status')}</th>
                <th>{t('Current content')}</th>
              </tr>
            </thead>
            <tbody>
              {screens.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={4}>{t('No screens available.')}</td>
                </tr>
              ) : (
                screens.map(screen => {
                  const isSelected = selectedScreenId === screen.id
                  const contentLabel = screen.content_type
                    ? screen.content_type
                    : t('no content')

                  return (
                    <tr
                      key={screen.id}
                      className={`${styles.tableRow} ${isSelected ? styles.selectedRow : ''}`}
                      onClick={() => setSelectedScreenId(screen.id)}
                    >
                      <td className={styles.tableCell}>
                        <span className={`${styles.radioMark} ${isSelected ? styles.radioMarkSelected : ''}`}>
                          {isSelected && <Check size={13} />}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.nameCell}>
                          <Monitor size={18} />
                          <span>{screen.name || t('Unnamed Screen')}</span>
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={`${styles.statusPill} ${styles[screen.status]}`}>
                          {getScreenStatusLabel(screen.status)}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.contentLabel}>{contentLabel}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={onClose} type="button">
            {t('Cancel')}
          </button>
          <button
            className={styles.primaryBtn}
            onClick={handlePush}
            type="button"
            disabled={!selectedScreenId || isPending || Boolean(success)}
          >
            {isPending ? t('Pushing...') : t('Push asset')}
          </button>
        </footer>
      </section>
    </div>
  )
}
