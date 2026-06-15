'use client'

import React, { useTransition, useRef, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { deleteAssetsBulk } from './actions'
import styles from './Modal.module.css'
import { t } from '@/lib/i18n'

import { toast } from '@/app/components/Toast'

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
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    startTransition(async () => {
      const items = assetsToDelete.map(a => ({ id: a.id, filePath: a.file_path }))
      const result = await deleteAssetsBulk(teamSlug, items)
      if (result.success) {
        toast.success(
          assetsToDelete.length === 1
            ? t('Asset deleted successfully')
            : `${assetsToDelete.length} ${t('assets deleted successfully')}`
        )
        onSuccess()
      } else {
        toast.error(result.error || 'Failed to delete selected assets.')
      }
    })
  }

  // Support drag-out close protection
  const dragStartOnBackdrop = useRef(false)
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartOnBackdrop.current = e.target === overlayRef.current
  }
  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && dragStartOnBackdrop.current) {
      onClose()
    }
  }

  return (
    <div 
      className={styles.modalOverlay} 
      ref={overlayRef} 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div 
        className={styles.modalContainer} 
        role="dialog" 
        style={{ maxWidth: '440px', width: '100%', padding: '24px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={22} />
              {t('Delete Selected Assets')}
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
              {t('You are about to delete')} <strong>{assetsToDelete.length}</strong> {assetsToDelete.length === 1 ? t('asset') : t('assets')}.
            </p>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={18} /></button>
        </div>
        
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
          <button 
            style={{ 
              padding: '10px 16px', 
              background: 'var(--error)', 
              color: 'var(--on-primary)', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: isPending ? 'not-allowed' : 'pointer', 
              fontWeight: 600, 
              fontFamily: 'var(--font-label)',
              opacity: isPending ? 0.7 : 1
            }} 
            onClick={handleConfirm} 
            disabled={isPending}
          >
            {isPending ? t('Deleting…') : t('Confirm Delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
