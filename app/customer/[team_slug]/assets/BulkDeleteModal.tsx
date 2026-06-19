'use client'

import React, { useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { deleteAssetsBulk } from './actions'
import styles from './Modal.module.css'
import { useTranslation } from '@/lib/i18n'
import { toast } from '@/app/components/Toast'
import Modal from '../components/Modal'

export interface BulkDeleteModalProps {
  assetsToDelete: { id: string; file_name: string; file_path: string }[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function BulkDeleteModal({
  assetsToDelete,
  teamSlug,
  onClose,
  onSuccess,
}: BulkDeleteModalProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = React.useState(0)
  const [isDeleting, setIsDeleting] = React.useState(false)

  async function handleConfirm() {
    setIsDeleting(true)
    setProgress(0)
    
    let successCount = 0
    let lastError = ''

    for (let i = 0; i < assetsToDelete.length; i++) {
      const asset = assetsToDelete[i]
      const result = await deleteAssetsBulk(teamSlug, [{ id: asset.id, filePath: asset.file_path }])
      if (result.success) {
        successCount++
      } else {
        lastError = result.error || t('Failed to delete asset.')
      }
      setProgress(i + 1)
    }

    setIsDeleting(false)

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? t('Asset deleted successfully')
          : t('{count} assets deleted successfully', { count: String(successCount) })
      )
      onSuccess()
    } else {
      toast.error(lastError || t('Failed to delete selected assets.'))
      onClose()
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Delete Selected Assets')}
      subtitle={
        <div style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
          {t('You are about to delete')} <strong>{assetsToDelete.length}</strong> {assetsToDelete.length === 1 ? t('asset') : t('assets')}.
        </div>
      }
      maxWidth="440px"
    >
      <div className={styles.form}>
        <div style={{ background: 'var(--error-container)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--error)', margin: 0, fontWeight: 700, lineHeight: '1.4' }}>
            {t('Warning: This action is permanent and cannot be undone. Selected files will be deleted from storage and screens playing these assets will stop displaying them.')}
          </p>
        </div>

        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--outline-variant)', borderRadius: '8px', padding: '8px 12px', background: 'var(--surface-low)', marginBottom: '24px' }}>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.82rem', color: 'var(--on-surface)', lineHeight: '1.5' }}>
            {assetsToDelete.map(a => (
              <li key={a.id} style={{ wordBreak: 'break-all' }}>{a.file_name}</li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            className={styles.submitBtn}
            style={{ background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
            onClick={onClose} 
            disabled={isDeleting}
          >
            {t('Cancel')}
          </button>
          <button 
            type="button"
            className={styles.submitBtn}
            style={{ background: 'var(--error)', color: 'var(--on-primary)', border: 'none' }}
            onClick={handleConfirm} 
            disabled={isDeleting}
          >
            {isDeleting 
              ? t('Deleting {current} of {total}...', { current: String(progress), total: String(assetsToDelete.length) }) 
              : t('Confirm Delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
