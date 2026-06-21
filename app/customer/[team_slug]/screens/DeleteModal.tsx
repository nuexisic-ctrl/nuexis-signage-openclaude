import React, { useTransition } from 'react'
import styles from './Modal.module.css'
import { deleteAndUnpairDevice } from './actions'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'
import { createClient } from '@/lib/supabase/client'

export interface DeleteModalProps {
  deviceId: string
  deviceName: string
  teamSlug: string
  status?: string
  onClose: () => void
  onSuccess: () => void
}

export function DeleteModal({
  deviceId,
  deviceName,
  teamSlug,
  status,
  onClose,
  onSuccess,
}: DeleteModalProps) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      // Send unpair broadcast to the device(s) so they reset immediately
      const supabase = createClient()
      const ids = deviceId.split(',')
      for (const id of ids) {
        const channel = supabase.channel(`device-pair-${id}`)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'unpair',
              payload: {}
            }).catch(console.error)
            setTimeout(() => supabase.removeChannel(channel), 1000)
          }
        })
      }

      const result = await deleteAndUnpairDevice(teamSlug, deviceId)
      if (result.success) {
        onSuccess()
      }
    })
  }

  const isOnline = status === 'online'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Delete Screen')}
      subtitle={t('Are you sure you want to unpair and delete {name}?', { name: deviceName })}
      maxWidth="400px"
    >
      {isOnline && (
        <div style={{ background: 'var(--error-container)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--error)', margin: 0, fontWeight: 700, lineHeight: '1.4' }}>
            {t('Warning: This screen is currently online and active. Deleting it will immediately interrupt playback and disconnect the display.')}
          </p>
        </div>
      )}

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
          style={{ background: 'var(--error)', color: 'var(--on-primary)', border: 'none' }} 
          onClick={handleConfirm} 
          disabled={isPending}
        >
          {isPending ? t('Deleting…') : t('Delete Screen')}
        </button>
      </div>
    </Modal>
  )
}
