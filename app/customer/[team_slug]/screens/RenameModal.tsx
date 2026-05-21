import React, { useState, useTransition, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import styles from './Modal.module.css'
import { updateDeviceName } from './actions'

export interface RenameModalProps {
  currentName: string
  teamSlug: string
  deviceId: string
  onClose: () => void
  onSuccess: (newName: string) => void
}

export function RenameModal({
  currentName,
  teamSlug,
  deviceId,
  onClose,
  onSuccess,
}: RenameModalProps) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

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
      const result = await updateDeviceName(teamSlug, deviceId, trimmed)
      if (result.success) {
        onSuccess(trimmed)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" style={{ maxWidth: '400px' }}>
        <div className={styles.modalHeader} style={{ marginBottom: '16px' }}>
          <div>
            <h2 className={styles.modalTitle}>Rename Screen</h2>
            <p className={styles.modalSubtitle}>Enter a new name for this screen.</p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="rename-input" className={styles.label}>Screen Name</label>
            <input
              id="rename-input"
              className={styles.input}
              type="text"
              placeholder="e.g. Lobby Display, Reception TV"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className={styles.errorMsg} role="alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className={styles.submitBtn}
              style={{ background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending || !name.trim() || name.trim() === currentName}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
