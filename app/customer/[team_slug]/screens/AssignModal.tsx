import React, { useState, useTransition, useRef, useEffect } from 'react'
import { AlertTriangle, X, Tv } from 'lucide-react'
import styles from './Modal.module.css'
import { Device, Asset, Playlist } from './types'
import { updateDeviceAssignment, AssignmentData } from './actions'
import { AssetBrowserModal } from './AssetBrowserModal'
import { PlaylistBrowserModal } from './PlaylistBrowserModal'

export interface AssignModalProps {
  device: Device
  assets: Asset[]
  playlists: Playlist[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
  onPreview?: (
    device: Device,
    contentType: 'Asset' | 'Playlist' | 'Schedule',
    assetId: string | null,
    playlistId: string | null,
    scaleMode: string,
    orientation: number
  ) => void
}

export function AssignModal({
  device,
  assets,
  playlists,
  teamSlug,
  onClose,
  onSuccess,
  onPreview,
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
  const [showAssetBrowser, setShowAssetBrowser] = useState(false)
  const [showPlaylistBrowser, setShowPlaylistBrowser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)
  const selectedAsset = assets.find(a => a.id === assetId)
  const selectedPlaylist = playlists.find(p => p.id === playlistId)

  // Scroll containment hook - locks background scroll when assigning content
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Automatically open browser modal on mount and when content type changes
  useEffect(() => {
    if (contentType === 'Asset') {
      setShowAssetBrowser(true)
      setShowPlaylistBrowser(false)
    } else if (contentType === 'Playlist') {
      setShowPlaylistBrowser(true)
      setShowAssetBrowser(false)
    }
  }, [contentType])

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
    <>
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
                <option value="Playlist">Content Loop</option>
                <option value="Schedule" disabled>Schedule (Coming Soon)</option>
              </select>
            </div>

            {contentType === 'Asset' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Selected Asset</label>
                <div 
                  className={styles.customSelectTrigger} 
                  onClick={() => setShowAssetBrowser(true)}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAssetBrowser(true); } }}
                >
                  <span className={selectedAsset ? styles.selectedText : styles.placeholderText}>
                    {selectedAsset ? selectedAsset.file_name : 'No asset selected'}
                  </span>
                  <button 
                    type="button" 
                    className={styles.browseButton}
                    onClick={(e) => { e.stopPropagation(); setShowAssetBrowser(true); }}
                  >
                    Browse
                  </button>
                </div>
              </div>
            )}

            {contentType === 'Playlist' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Selected Content Loop</label>
                <div 
                  className={styles.customSelectTrigger} 
                  onClick={() => setShowPlaylistBrowser(true)}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlaylistBrowser(true); } }}
                >
                  <span className={selectedPlaylist ? styles.selectedText : styles.placeholderText}>
                    {selectedPlaylist ? selectedPlaylist.name : 'No Content Loop selected'}
                  </span>
                  <button 
                    type="button" 
                    className={styles.browseButton}
                    onClick={(e) => { e.stopPropagation(); setShowPlaylistBrowser(true); }}
                  >
                    Browse
                  </button>
                </div>
              </div>
            )}

            {!(contentType === 'Playlist' || (contentType === 'Asset' && selectedAsset?.mime_type?.startsWith('application/x-widget'))) && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Scale Mode</label>
                <select className={styles.input} value={scaleMode} onChange={(e) => setScaleMode(e.target.value as 'None' | 'Fit' | 'Stretch' | 'Zoom')}>
                  <option value="None">None</option>
                  <option value="Fit">Fit</option>
                  <option value="Stretch">Stretch</option>
                  <option value="Zoom">Zoom</option>
                </select>
              </div>
            )}

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

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {onPreview && (
                <button
                  type="button"
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0 16px',
                    background: 'var(--surface-low)',
                    color: 'var(--primary)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-label)',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => onPreview(device, contentType, assetId || null, playlistId || null, scaleMode, orientation)}
                >
                  <Tv size={16} />
                  Preview Screen
                </button>
              )}

              <button 
                className={styles.submitBtn} 
                type="submit" 
                disabled={isPending || (contentType === 'Asset' && !assetId) || (contentType === 'Playlist' && !playlistId)}
                style={{ flex: 1.2 }}
              >
                {isPending ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAssetBrowser && (
        <AssetBrowserModal
          assets={assets}
          onClose={() => setShowAssetBrowser(false)}
          onSelect={(id) => {
            setAssetId(id)
            setShowAssetBrowser(false)
          }}
        />
      )}

      {showPlaylistBrowser && (
        <PlaylistBrowserModal
          playlists={playlists}
          onClose={() => setShowPlaylistBrowser(false)}
          onSelect={(id) => {
            setPlaylistId(id)
            setShowPlaylistBrowser(false)
          }}
        />
      )}
    </>
  )
}
