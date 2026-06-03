'use client'

import { useTransition, useRef, useState } from 'react'
import { Folder, X, AlertTriangle } from 'lucide-react'
import { moveAssetsToFolder } from './actions'
import { Asset } from './types'
import { t } from '@/lib/i18n'
import styles from './Modal.module.css'

export function BulkMoveModal({
  selectedAssets,
  folders,
  teamSlug,
  onClose,
  onSuccess,
}: {
  selectedAssets: Asset[]
  folders: Asset[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleMove(folderId: string | null) {
    startTransition(async () => {
      const assetIds = selectedAssets.map(a => a.id)
      const result = await moveAssetsToFolder(teamSlug, assetIds, folderId)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || t('Failed to move assets.'))
      }
    })
  }

  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div 
        className={styles.modalContainer} 
        style={{ padding: '24px', maxWidth: '440px', width: '100%' }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
              {t('Move to Folder')}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--on-surface-subtle)' }}>
              {t('Select target folder for')} <strong>{selectedAssets.length}</strong> {selectedAssets.length === 1 ? t('asset') : t('assets')}.
            </p>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={18} /></button>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" style={{ marginBottom: '16px' }}>
            <AlertTriangle className={styles.errorIcon} size={17} />
            {error}
          </div>
        )}

        <div 
          style={{ 
            maxHeight: '260px', 
            overflowY: 'auto', 
            border: '1px solid var(--outline-variant)', 
            borderRadius: '10px', 
            background: 'var(--surface-low)', 
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Root Level Option */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleMove(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              fontWeight: 600,
              textAlign: 'left',
              cursor: isPending ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-medium)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Folder size={18} style={{ stroke: '#78716c', color: '#78716c' }} />
            <span>{t('Root (No Folder)')}</span>
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
                onClick={() => handleMove(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--outline-variant)',
                  color: 'var(--on-surface)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  width: '100%',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-medium)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Folder size={18} style={{ stroke: f.color || '#78716c', fill: f.color || '#78716c', fillOpacity: 0.15 }} />
                <span>{f.file_name}</span>
              </button>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            style={{ 
              padding: '10px 16px', 
              background: 'var(--surface-low)', 
              color: 'var(--on-surface)', 
              border: '1px solid var(--outline-variant)', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 600, 
              fontFamily: 'var(--font-label)' 
            }} 
            onClick={onClose} 
            disabled={isPending}
          >
            {t('Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
