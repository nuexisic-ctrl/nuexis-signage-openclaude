'use client'

import { useTransition, useRef, useState } from 'react'
import { Folder, X, AlertTriangle } from 'lucide-react'
import { moveAssetsToFolder } from './actions'
import { Asset } from './types'
import { t } from '@/lib/i18n'
import styles from './Modal.module.css'
import listStyles from './BulkMoveModal.module.css'
import { useA11yModal } from '@/lib/utils/useA11yModal'

export function BulkMoveModal({
  selectedAssets,
  folders,
  teamSlug,
  onClose,
  onMoveAssets,
}: {
  selectedAssets: Asset[]
  folders: Asset[]
  teamSlug: string
  onClose: () => void
  onMoveAssets: (assetIds: string[], targetFolderId: string | null, targetFolderName: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useA11yModal({
    id: 'bulk-move-modal',
    onClose,
    initialFocusSelector: 'button[data-modal-close="true"]',
  })

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleMove(folderId: string | null, folderName: string) {
    const assetIds = selectedAssets.map(a => a.id)
    onMoveAssets(assetIds, folderId, folderName)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={handleOverlayClick} role="presentation">
      <div 
        className={styles.modalContainer} 
        style={{ padding: '24px', maxWidth: '440px', width: '100%' }} 
        onClick={e => e.stopPropagation()}
        ref={dialogRef as any}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-move-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2
              id="bulk-move-title"
              style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}
            >
              {t('Move to Folder')}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--on-surface-subtle)' }}>
              {t('Select target folder for')} <strong>{selectedAssets.length}</strong> {selectedAssets.length === 1 ? t('asset') : t('assets')}.
            </p>
          </div>
          <button
            data-modal-close="true"
            onClick={onClose}
            className={styles.modalCloseBtn}
            aria-label="Close modal"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" style={{ marginBottom: '16px' }}>
            <AlertTriangle className={styles.errorIcon} size={17} />
            {error}
          </div>
        )}

        <div className={listStyles.list}>
          {/* Root Level Option */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleMove(null, t('Root'))}
            className={listStyles.listButton}
            aria-label={t('Move to Root')}
          >
            <Folder size={18} style={{ stroke: '#78716c', color: '#78716c' }} />
            <span className={listStyles.folderLabel}>
              <span className={listStyles.folderName}>{t('Root')}</span>
            </span>
          </button>

          {folders.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--on-surface-subtle)', fontSize: '0.86rem' }}>
              {t('No other folders created yet.')}
            </div>
          ) : (
            folders.map(f => (
              <button
                key={f.id}
                type="button"
                disabled={isPending}
                onClick={() => handleMove(f.id, f.file_name)}
                className={listStyles.listButton}
                aria-label={`${t('Move to folder')} ${f.file_name}`}
              >
                <Folder size={18} style={{ stroke: f.color || '#78716c', fill: f.color || '#78716c', fillOpacity: 0.15 }} />
                <span className={listStyles.folderLabel}>
                  <span className={listStyles.folderName}>{f.file_name}</span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className={listStyles.footer}>
          <button className={listStyles.secondaryBtn} onClick={onClose} disabled={isPending} type="button">
            {t('Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
