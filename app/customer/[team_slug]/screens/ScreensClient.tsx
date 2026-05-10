'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { claimDevice, updateDeviceAssignment, AssignmentData } from './actions'
import styles from './screens.module.css'

interface Device {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  created_at: string
  content_type?: string | null
  asset_id?: string | null
  scale_mode?: string | null
  orientation?: number | null
}

export interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
}

interface Props {
  devices: Device[]
  assets: Asset[]
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

function DeviceCard({ device, onClick }: { device: Device; onClick?: () => void }) {
  const createdAt = new Date(device.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className={`${styles.deviceCard} ${onClick ? styles.clickableCard : ''}`} onClick={onClick}>
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

function AssignModal({
  device,
  assets,
  teamSlug,
  onClose,
  onSuccess,
}: {
  device: Device
  assets: Asset[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | 'Schedule'>(
    (device.content_type as 'Asset' | 'Playlist' | 'Schedule') || 'Asset'
  )
  const [assetId, setAssetId] = useState<string>(device.asset_id || '')
  const [scaleMode, setScaleMode] = useState<'None' | 'Fit' | 'Stretch' | 'Zoom'>(
    (device.scale_mode as 'None' | 'Fit' | 'Stretch' | 'Zoom') || 'Fit'
  )
  const [orientation, setOrientation] = useState<0 | 90 | 180 | 270>(
    (device.orientation as 0 | 90 | 180 | 270) || 0
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const data: AssignmentData = {
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        scale_mode: scaleMode,
        orientation,
      }
      const result = await updateDeviceAssignment(teamSlug, device.id, data)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog">
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Assign Content</h2>
            <p className={styles.modalSubtitle}>Configure what plays on {device.name || 'Unnamed Screen'}</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Content Type</label>
            <select className={styles.input} value={contentType} onChange={(e) => setContentType(e.target.value as any)}>
              <option value="Asset">Asset</option>
              <option value="Playlist" disabled>Playlist (Coming Soon)</option>
              <option value="Schedule" disabled>Schedule (Coming Soon)</option>
            </select>
          </div>

          {contentType === 'Asset' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Selected Asset</label>
              <select className={styles.input} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">-- Select an asset --</option>
                {assets.map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.file_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Scale Mode</label>
            <select className={styles.input} value={scaleMode} onChange={(e) => setScaleMode(e.target.value as any)}>
              <option value="None">None</option>
              <option value="Fit">Fit</option>
              <option value="Stretch">Stretch</option>
              <option value="Zoom">Zoom</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Orientation</label>
            <select className={styles.input} value={orientation} onChange={(e) => setOrientation(Number(e.target.value) as any)}>
              <option value={0}>Landscape (0°)</option>
              <option value={90}>Rotate 90°</option>
              <option value={180}>Rotate 180°</option>
              <option value={270}>Rotate 270°</option>
            </select>
          </div>

          {error && <div className={styles.errorMsg}><span>⚠</span>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={isPending || (contentType === 'Asset' && !assetId)}>
            {isPending ? 'Saving…' : 'Save Assignment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScreensClient({ devices: initialDevices, assets, teamSlug }: Props) {
  const [showPairModal, setShowPairModal] = useState(false)
  const [assignModalDevice, setAssignModalDevice] = useState<Device | null>(null)
  const router = useRouter()

  function handlePairSuccess() {
    setShowPairModal(false)
    router.refresh()
  }

  function handleAssignSuccess() {
    setAssignModalDevice(null)
    router.refresh()
  }

  return (
    <>
      <button
        id="add-screen-btn"
        className={styles.addBtn}
        onClick={() => setShowPairModal(true)}
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
            <DeviceCard key={device.id} device={device} onClick={() => setAssignModalDevice(device)} />
          ))
        )}
      </div>

      {showPairModal && (
        <PairModal
          teamSlug={teamSlug}
          onClose={() => setShowPairModal(false)}
          onSuccess={handlePairSuccess}
        />
      )}

      {assignModalDevice && (
        <AssignModal
          device={assignModalDevice}
          assets={assets}
          teamSlug={teamSlug}
          onClose={() => setAssignModalDevice(null)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </>
  )
}
