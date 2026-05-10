'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { claimDevice } from './actions'
import styles from './screens.module.css'

interface Device {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  created_at: string
}

interface Props {
  devices: Device[]
  teamSlug: string
}

function StatusBadge({ status }: { status: Device['status'] }) {
  const cls = {
    online:  styles.statusOnline,
    offline: styles.statusOffline,
    pairing: styles.statusPairing,
  }[status]

  const dotCls = {
    online:  styles.statusDotOnline,
    offline: styles.statusDotOffline,
    pairing: styles.statusDotPairing,
  }[status]

  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <span className={`${styles.statusDot} ${dotCls}`} />
      {status}
    </span>
  )
}

function DeviceCard({ device }: { device: Device }) {
  const createdAt = new Date(device.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className={styles.deviceCard}>
      <div className={styles.deviceCardHeader}>
        <h3 className={styles.deviceName}>{device.name || 'Unnamed Screen'}</h3>
        <StatusBadge status={device.status} />
      </div>
      <div className={styles.deviceMeta}>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>Added</span>
          <span className={styles.deviceMetaValue}>{createdAt}</span>
        </div>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>ID</span>
          <span className={styles.deviceMetaValue} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {device.id.slice(0, 8)}…
          </span>
        </div>
      </div>
    </div>
  )
}

function PairModal({
  teamSlug,
  onClose,
  onSuccess,
}: {
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [code, setCode]       = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await claimDevice(teamSlug, code, name)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      id="pair-modal-overlay"
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-title" className={styles.modalTitle}>Add Screen</h2>
            <p className={styles.modalSubtitle}>
              Open the NuExis player app on your screen and enter the 6-digit code shown.
            </p>
          </div>
          <button
            id="modal-close-btn"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="pairing-code" className={styles.label}>Pairing Code</label>
            <input
              id="pairing-code"
              className={styles.codeInput}
              type="text"
              inputMode="numeric"
              placeholder="000 000"
              maxLength={7}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(val)
                if (val.length === 6) {
                  document.getElementById('screen-name')?.focus()
                }
              }}
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="screen-name" className={styles.label}>Screen Name</label>
            <input
              id="screen-name"
              className={styles.input}
              type="text"
              placeholder="e.g. Lobby Display, Reception TV"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.errorMsg} role="alert">
              <span>⚠</span>
              {error}
            </div>
          )}

          <button
            id="pair-submit-btn"
            className={styles.submitBtn}
            type="submit"
            disabled={isPending || code.length !== 6 || name.trim().length === 0}
          >
            {isPending ? 'Pairing…' : 'Pair Screen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScreensClient({ devices: initialDevices, teamSlug }: Props) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  function handleSuccess() {
    setShowModal(false)
    router.refresh()
  }

  return (
    <>
      <button
        id="add-screen-btn"
        className={styles.addBtn}
        onClick={() => setShowModal(true)}
      >
        <span className={styles.addBtnIcon}>+</span>
        Add Screen
      </button>

      <div className={styles.grid}>
        {initialDevices.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>◫</div>
            <h3 className={styles.emptyTitle}>No screens yet</h3>
            <p className={styles.emptyText}>
              Open the NuExis player app on a screen, then click{' '}
              <strong>Add Screen</strong> to pair it to your workspace.
            </p>
          </div>
        ) : (
          initialDevices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))
        )}
      </div>

      {showModal && (
        <PairModal
          teamSlug={teamSlug}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
