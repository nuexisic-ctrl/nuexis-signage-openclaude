import React, { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from './Modal.module.css'
import { updateDeviceName } from './actions'
import { toast } from '@/app/components/Toast'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'

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
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('Name cannot be empty.'))
      return
    }
    if (trimmed.length > 80) {
      setError(t('Name cannot be longer than 80 characters.'))
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
        toast.success(t('Screen renamed successfully'))
        onSuccess(trimmed)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Rename Screen')}
      subtitle={t('Enter a new name for this screen.')}
      maxWidth="400px"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label htmlFor="rename-input" className={styles.label}>{t('Screen Name')}</label>
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
            {t('Cancel')}
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending || !name.trim() || name.trim().length > 80 || name.trim() === currentName}
          >
            {isPending ? t('Saving…') : t('Save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
