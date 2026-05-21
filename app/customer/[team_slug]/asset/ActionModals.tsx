'use client'

import { useState, useRef, useTransition } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { deleteAsset, updateAssetName } from './actions'
import styles from './Modal.module.css'

export function RenameAssetModal({
  currentName,
  teamSlug,
  assetId,
  onClose,
  onSuccess,
}: {
  currentName: string
  teamSlug: string
  assetId: string
  onClose: () => void
  onSuccess: (newName: string) => void
}) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name cannot be empty.')
      return
    }
    if (trimmed === currentName) {
      onClose()
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateAssetName(teamSlug, assetId, trimmed)
      if (result.success) {
        onSuccess(trimmed)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Rename Asset</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Asset Name</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lobby Image, Promo Video"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
              autoFocus
            />
          </div>
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '10px 16px', background: 'var(--surface-low)', color: 'var(--on-surface)',
                border: '1px solid var(--outline-variant)', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || name.trim() === currentName}
              style={{
                padding: '10px 16px', background: 'var(--primary)', color: 'var(--on-primary)',
                border: 'none', borderRadius: '8px', cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteAssetModal({
  assetId,
  assetName,
  filePath,
  teamSlug,
  onClose,
  onSuccess,
}: {
  assetId: string
  assetName: string
  filePath: string
  teamSlug: string
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAsset(teamSlug, assetId, filePath)
      if (result.success) {
        onSuccess(assetId)
      }
    })
  }

  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modalContainer} role="dialog" style={{ maxWidth: '400px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--error)' }}>Delete Asset</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
              Are you sure you want to delete <strong>{assetName}</strong>?
            </p>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={18} /></button>
        </div>
        
        <p style={{ fontSize: '0.88rem', color: 'var(--on-surface)', marginBottom: '24px', lineHeight: '1.5' }}>
          This action will permanently remove the asset from your library. Any screens currently displaying this asset will stop showing it.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ padding: '10px 16px', background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)' }} 
            onClick={onClose} 
            disabled={isPending}
          >
            Cancel
          </button>
          <button 
            style={{ padding: '10px 16px', background: 'var(--error)', color: 'var(--on-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)' }} 
            onClick={handleConfirm} 
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}
