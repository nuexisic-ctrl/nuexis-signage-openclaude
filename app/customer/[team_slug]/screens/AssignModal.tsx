import React, { useState, useTransition, useRef, useEffect } from 'react'
import { AlertTriangle, X, Tv } from 'lucide-react'
import styles from './Modal.module.css'
import { Device, Asset, Playlist } from './types'
import { updateDeviceAssignment, updateDeviceName, AssignmentData } from './actions'
import { AssetBrowserModal } from '../components/AssetBrowser'
import { PlaylistBrowserModal } from './PlaylistBrowserModal'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'

export interface AssignModalProps {
  device: Device
  assets: Asset[]
  playlists: Playlist[]
  teamSlug: string
  teamId: string
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
  teamId,
  onClose,
  onSuccess,
  onPreview,
}: AssignModalProps) {
  const [screenName, setScreenName] = useState(device.name || '')
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | 'Schedule' | null>(
    (device.content_type as 'Asset' | 'Playlist' | 'Schedule' | null) || null
  )
  const [assetId, setAssetId] = useState<string>(device.asset_id || '')
  const [playlistId, setPlaylistId] = useState<string>(device.playlist_id || '')
  const [scaleMode, setScaleMode] = useState<'None' | 'Fit' | 'Stretch' | 'Zoom'>(() => {
    if (device.scale_mode) return device.scale_mode as 'None' | 'Fit' | 'Stretch' | 'Zoom'
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

  // Scroll containment hook & modalStack registration
  useEffect(() => {
    modalStack.push('assign-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('assign-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Close modal on Escape if it is the topmost modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalStack.isTop('assign-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Opens the appropriate browser when the user explicitly changes content type.
  // This is intentionally NOT a useEffect — effects fire on mount too (and twice
  // in React Strict Mode), which caused the browser to pop open immediately.
  function handleContentTypeChange(newType: 'Asset' | 'Playlist' | 'Schedule' | '') {
    if (newType === '') {
      setContentType(null)
      setShowAssetBrowser(false)
      setShowPlaylistBrowser(false)
    } else {
      setContentType(newType as any)
      if (newType === 'Asset') {
        setShowAssetBrowser(true)
        setShowPlaylistBrowser(false)
      } else if (newType === 'Playlist') {
        setShowPlaylistBrowser(true)
        setShowAssetBrowser(false)
      } else {
        setShowAssetBrowser(false)
        setShowPlaylistBrowser(false)
      }
    }
  }

  const childWasActiveRef = useRef(false)

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) {
      childWasActiveRef.current = modalStack.hasActiveChildOf('assign-modal')
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) {
      if (childWasActiveRef.current) {
        childWasActiveRef.current = false
        return
      }
      onClose()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`scale_mode_${device.id}`, scaleMode)
    }
    startTransition(async () => {
      const trimmedName = screenName.trim()
      const originalName = (device.name || '').trim()
      if (trimmedName && trimmedName !== originalName) {
        const nameResult = await updateDeviceName(teamSlug, device.id, trimmedName)
        if (!nameResult.success) {
          setError(nameResult.error)
          return
        }
      }

      const data: AssignmentData = {
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        playlist_id: contentType === 'Playlist' ? (playlistId || null) : null,
        orientation,
        scale_mode: scaleMode,
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
      <div 
        className={styles.overlay} 
        ref={overlayRef} 
        onMouseDown={handleOverlayMouseDown} 
        onClick={handleOverlayClick}
      >
        <div className={styles.modal} role="dialog">
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>Assign Content</h2>
              <p className={styles.modalSubtitle}>Configure what plays on {device.name || 'Unnamed Screen'}</p>
            </div>
            <button className={styles.modalClose} onClick={onClose} aria-label="Close modal"><X size={18} /></button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {device.app_version?.toLowerCase().includes('web player') && (
              <div className={styles.warningMsg}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Web Player is not recommended for production use. Please consider using supported platforms such as Android, Windows, or Linux.
                </span>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Screen Name</label>
              <input
                type="text"
                maxLength={60}
                className={styles.input}
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                disabled={isPending}
                placeholder="E.g., Reception Monitor"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Content Type</label>
              <CustomSelect
                id="assign-content-type"
                value={contentType || ''}
                onChange={(val) => handleContentTypeChange(val as 'Asset' | 'Playlist' | 'Schedule' | '')}
                options={[
                  ...(!contentType ? [{ value: '', label: 'no content', disabled: true }] : []),
                  { value: 'Asset', label: 'Asset' },
                  { value: 'Playlist', label: 'Playlist' },
                  { value: 'Schedule', label: 'Schedule (Coming Soon)', disabled: true }
                ]}
              />
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
                  <span className={selectedAsset ? styles.selectedText : styles.placeholderText} style={{ display: 'inline-flex', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', marginRight: '8px' }}>
                    {selectedAsset ? <FilenameTruncator filename={selectedAsset.file_name} /> : 'No asset selected'}
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
                <label className={styles.label}>Selected Playlist</label>
                <div 
                  className={styles.customSelectTrigger} 
                  onClick={() => setShowPlaylistBrowser(true)}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlaylistBrowser(true); } }}
                >
                  <span className={selectedPlaylist ? styles.selectedText : styles.placeholderText}>
                    {selectedPlaylist ? selectedPlaylist.name : 'No Playlist selected'}
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

            {!(contentType === 'Playlist' || (contentType === 'Asset' && selectedAsset?.mime_type?.startsWith('application/x-widget') && selectedAsset?.mime_type !== 'application/x-widget-qrcode')) && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Scale Mode</label>
                <CustomSelect
                  id="assign-scale-mode"
                  value={scaleMode}
                  onChange={(val) => setScaleMode(val)}
                  options={[
                    { value: 'None', label: 'None' },
                    { value: 'Fit', label: 'Fit' },
                    { value: 'Stretch', label: 'Stretch' },
                    { value: 'Zoom', label: 'Zoom' }
                  ]}
                />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Orientation</label>
              <CustomSelect
                id="assign-orientation"
                value={orientation}
                onChange={(val) => setOrientation(Number(val) as 0 | 90 | 180 | 270)}
                options={[
                  { value: 0, label: 'Landscape (0°)' },
                  { value: 90, label: 'Rotate 90°' },
                  { value: 180, label: 'Rotate 180°' },
                  { value: 270, label: 'Rotate 270°' }
                ]}
              />
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
                    cursor: contentType ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: contentType ? 1 : 0.5
                  }}
                  onClick={() => contentType && onPreview(device, contentType, assetId || null, playlistId || null, scaleMode, orientation)}
                  disabled={!contentType}
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
                {isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAssetBrowser && (
        <AssetBrowserModal
          assets={assets}
          teamSlug={teamSlug}
          teamId={teamId}
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
