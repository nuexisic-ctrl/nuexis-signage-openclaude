import React, { useState, useTransition } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { AssetBrowserModal } from '../components/AssetBrowser'
import { PlaylistBrowserModal } from '../screens/PlaylistBrowserModal'
import { assignContentToGroup } from './actions'
import styles from './groups.module.css'
import { Group } from './types'

interface AssignContentProps {
  group: Group
  assets: any[]
  playlists: any[]
  teamSlug: string
  onClose: () => void
  router: any
}

export function AssignContentModal({
  group,
  assets,
  playlists,
  teamSlug,
  onClose,
  router
}: AssignContentProps) {
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | null>(
    (group.content_type as 'Asset' | 'Playlist' | null) || null
  )
  const [assetId, setAssetId] = useState<string>(group.asset_id || '')
  const [playlistId, setPlaylistId] = useState<string>(group.playlist_id || '')
  const [orientation, setOrientation] = useState<0 | 90 | 180 | 270>(
    (group.orientation as 0 | 90 | 180 | 270) || 0
  )

  const [showAssetBrowser, setShowAssetBrowser] = useState(false)
  const [showPlaylistBrowser, setShowPlaylistBrowser] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedAsset = assets.find(a => a.id === assetId)
  const selectedPlaylist = playlists.find(p => p.id === playlistId)

  const handleContentTypeChange = (newType: 'Asset' | 'Playlist' | '') => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const data = {
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        playlist_id: contentType === 'Playlist' ? (playlistId || null) : null,
        orientation
      }
      const res = await assignContentToGroup(teamSlug, group.id, data)
      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error || 'Failed to assign content')
      }
    })
  }

  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>Assign Content</h2>
              <p className={styles.pageSubtitle} style={{ marginTop: '2px' }}>
                Set content for group <strong>{group.name}</strong>
              </p>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Content Type</label>
                <select 
                  className={styles.formInput} 
                  value={contentType || ''} 
                  onChange={(e) => handleContentTypeChange(e.target.value as any)}
                >
                  {!contentType && (
                    <option value="" disabled>no content</option>
                  )}
                  <option value="Asset">Asset</option>
                  <option value="Playlist">Playlist</option>
                </select>
              </div>

              {contentType === 'Asset' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Selected Asset</label>
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'var(--surface-lowest)'
                    }}
                    onClick={() => setShowAssetBrowser(true)}
                  >
                    <span style={{ fontSize: '0.875rem', color: selectedAsset ? 'var(--on-surface)' : 'var(--on-surface-subtle)' }}>
                      {selectedAsset ? selectedAsset.file_name : 'No asset selected'}
                    </span>
                    <button
                      type="button"
                      style={{
                        padding: '4px 10px',
                        background: 'var(--surface-low)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => { e.stopPropagation(); setShowAssetBrowser(true); }}
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}

              {contentType === 'Playlist' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Selected Playlist</label>
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'var(--surface-lowest)'
                    }}
                    onClick={() => setShowPlaylistBrowser(true)}
                  >
                    <span style={{ fontSize: '0.875rem', color: selectedPlaylist ? 'var(--on-surface)' : 'var(--on-surface-subtle)' }}>
                      {selectedPlaylist ? selectedPlaylist.name : 'No playlist selected'}
                    </span>
                    <button
                      type="button"
                      style={{
                        padding: '4px 10px',
                        background: 'var(--surface-low)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => { e.stopPropagation(); setShowPlaylistBrowser(true); }}
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Orientation Override</label>
                <select 
                  className={styles.formInput} 
                  value={orientation} 
                  onChange={(e) => setOrientation(Number(e.target.value) as any)}
                >
                  <option value={0}>Landscape (0°)</option>
                  <option value={90}>Rotate 90°</option>
                  <option value={180}>Rotate 180°</option>
                  <option value={270}>Rotate 270°</option>
                </select>
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />{error}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
              <button 
                type="submit" 
                disabled={isPending || !contentType || (contentType === 'Asset' && !assetId) || (contentType === 'Playlist' && !playlistId)} 
                className={`${styles.btn} ${styles.btnPrimary}`}
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
