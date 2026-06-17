import React, { useTransition, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'
import { deleteAndUnpairDevice } from './actions'
import { useTranslation } from '@/lib/i18n'

export interface DeleteModalProps {
  deviceId: string
  deviceName: string
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function DeleteModal({
  deviceId,
  deviceName,
  teamSlug,
  onClose,
  onSuccess,
}: DeleteModalProps) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAndUnpairDevice(teamSlug, deviceId)
      if (result.success) {
        onSuccess()
      }
    })
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" style={{ maxWidth: '400px' }}>
        <div className={styles.modalHeader} style={{ marginBottom: '16px' }}>
          <div>
            <h2 className={styles.modalTitle} style={{ color: 'var(--error)' }}>{t('Delete Screen')}</h2>
            <p className={styles.modalSubtitle}>
              {t('Are you sure you want to unpair and delete {name}?', { name: deviceName })}
            </p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label={t('Close modal')}><X size={18} /></button>
        </div>
        
        <p style={{ fontSize: '0.88rem', color: 'var(--on-surface)', marginBottom: '24px', lineHeight: '1.5' }}>
          {t('The physical screen will automatically reset to pairing mode. This action cannot be undone.')}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            className={styles.submitBtn} 
            style={{ background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }} 
            onClick={onClose} 
            disabled={isPending}
          >
            {t('Cancel')}
          </button>
          <button 
            type="button"
            className={styles.submitBtn} 
            style={{ background: 'var(--error)', color: 'var(--on-primary)' }} 
            onClick={handleConfirm} 
            disabled={isPending}
          >
            {isPending ? t('Deleting…') : t('Delete Screen')}
          </button>
        </div>
      </div>
    </div>
  )
}
