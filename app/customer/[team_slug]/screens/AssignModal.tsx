import React, { useState, useTransition, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import styles from './Modal.module.css'
import { Device, Asset, Playlist } from './types'
import { updateDeviceAssignment, AssignmentData } from './actions'

export interface AssignModalProps {
  device: Device
  assets: Asset[]
  playlists: Playlist[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function AssignModal({
  device,
  assets,
  playlists,
  teamSlug,
  onClose,
  onSuccess,
}: AssignModalProps) {
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | 'Schedule'>(
    (device.content_type as 'Asset' | 'Playlist' | 'Schedule') || 'Asset'
  )
  const [assetId, setAssetId] = useState<string>(device.asset_id || '')
  const [playlistId, setPlaylistId] = useState<string>(device.playlist_id || '')
  const [scaleMode, setScaleMode] = useState<'None' | 'Fit' | 'Stretch' | 'Zoom'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`scale_mode_${device.id}`) as 'None' | 'Fit' | 'Stretch' | 'Zoom') || 'Fit'
    }
    return 'Fit'
  })
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(`scale_mode_${device.id}`, scaleMode)
    }
    startTransition(async () => {
      const data: AssignmentData = {
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        playlist_id: contentType === 'Playlist' ? (playlistId || null) : null,
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
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Content Type</label>
            <select className={styles.input} value={contentType} onChange={(e) => setContentType(e.target.value as 'Asset' | 'Playlist' | 'Schedule')}>
              <option value="Asset">Asset</option>
              <option value="Playlist">Playlist</option>
              <option value="Schedule" disabled>Schedule (Coming Soon)</option>
            </select>
          </div>

          {contentType === 'Asset' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Selected Asset</label>
              <select className={styles.input} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">-- Select an item --</option>
                <optgroup label="Widgets">
                  {assets.filter(a => a.mime_type.startsWith('application/x-widget')).map(asset => (
                    <option key={asset.id} value={asset.id}>📺 {asset.file_name}</option>
                  ))}
                </optgroup>
                <optgroup label="Media Library">
                  {assets.filter(a => !a.mime_type.startsWith('application/x-widget')).map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.file_name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {contentType === 'Playlist' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Selected Playlist</label>
              <select className={styles.input} value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
                <option value="">-- Select a playlist --</option>
                {playlists.map(playlist => (
                  <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Scale Mode</label>
            <select className={styles.input} value={scaleMode} onChange={(e) => setScaleMode(e.target.value as 'None' | 'Fit' | 'Stretch' | 'Zoom')}>
              <option value="None">None</option>
              <option value="Fit">Fit</option>
              <option value="Stretch">Stretch</option>
              <option value="Zoom">Zoom</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Orientation</label>
            <select className={styles.input} value={orientation} onChange={(e) => setOrientation(Number(e.target.value) as 0 | 90 | 180 | 270)}>
              <option value={0}>Landscape (0°)</option>
              <option value={90}>Rotate 90°</option>
              <option value={180}>Rotate 180°</option>
              <option value={270}>Rotate 270°</option>
            </select>
          </div>

          {error && <div className={styles.errorMsg}><AlertTriangle size={16} />{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={isPending || (contentType === 'Asset' && !assetId) || (contentType === 'Playlist' && !playlistId)}>
            {isPending ? 'Saving…' : 'Save Assignment'}
          </button>
        </form>
      </div>
    </div>
  )
}
