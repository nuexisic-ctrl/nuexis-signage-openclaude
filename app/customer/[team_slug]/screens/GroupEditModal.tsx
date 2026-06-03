'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { X, Check, AlertTriangle, Monitor, Search, Tv } from 'lucide-react'
import styles from './GroupEditModal.module.css'
import { Asset, Playlist, Device } from './types'
import { saveGroupChanges } from '../groups/actions'
import { AssetBrowserModal } from './AssetBrowserModal'
import { PlaylistBrowserModal } from './PlaylistBrowserModal'

interface Group {
  id: string
  name: string
  color: string
  content_type: 'Asset' | 'Playlist' | 'Schedule' | null
  asset_id: string | null
  playlist_id: string | null
  orientation: number | null
}

interface GroupEditModalProps {
  group: Group
  devices: Device[]
  memberships: any[]
  assets: Asset[]
  playlists: Playlist[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose/red
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#64748b', // slate
]

export function GroupEditModal({
  group,
  devices,
  memberships,
  assets,
  playlists,
  teamSlug,
  onClose,
  onSuccess,
}: GroupEditModalProps) {
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color || PRESET_COLORS[0])
  const availableColors = React.useMemo(() => {
    if (group.color && !PRESET_COLORS.includes(group.color)) {
      return [...PRESET_COLORS, group.color]
    }
    return PRESET_COLORS
  }, [group.color])

  // Memberships: start with device IDs already in this group
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(() => {
    return memberships.filter(m => m.group_id === group.id).map(m => m.device_id)
  })

  // Dropdown & Search for screen selection
  const [showScreensDropdown, setShowScreensDropdown] = useState(false)
  const [screenSearchQuery, setScreenSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Content Configuration
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | 'Schedule' | null>(
    (group.content_type as 'Asset' | 'Playlist' | 'Schedule') || null
  )
  const [assetId, setAssetId] = useState<string>(group.asset_id || '')
  const [playlistId, setPlaylistId] = useState<string>(group.playlist_id || '')
  const [scaleMode, setScaleMode] = useState<'None' | 'Fit' | 'Stretch' | 'Zoom'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`scale_mode_group_${group.id}`) as 'None' | 'Fit' | 'Stretch' | 'Zoom') || 'Fit'
    }
    return 'Fit'
  })
  const [orientation, setOrientation] = useState<0 | 90 | 180 | 270>(
    (group.orientation as 0 | 90 | 180 | 270) || 0
  )

  const [showAssetBrowser, setShowAssetBrowser] = useState(false)
  const [showPlaylistBrowser, setShowPlaylistBrowser] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  const selectedAsset = assets.find(a => a.id === assetId)
  const selectedPlaylist = playlists.find(p => p.id === playlistId)

  // Scroll containment - lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowScreensDropdown(false)
      }
    }
    if (showScreensDropdown) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showScreensDropdown])

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

  const handleToggleDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    )
  }

  const handleRemoveDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev => prev.filter(id => id !== deviceId))
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Group name is required.')
      return
    }

    startTransition(async () => {
      const data = {
        name,
        color,
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        playlist_id: contentType === 'Playlist' ? (playlistId || null) : null,
        orientation,
        deviceIds: selectedDeviceIds
      }

      // Propagate scale mode locally if supported
      if (typeof window !== 'undefined') {
        localStorage.setItem(`scale_mode_group_${group.id}`, scaleMode)
        selectedDeviceIds.forEach(id => {
          localStorage.setItem(`scale_mode_${id}`, scaleMode)
        })
      }

      const result = await saveGroupChanges(teamSlug, group.id, data)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Failed to save group changes.')
      }
    })
  }

  // Filter devices list based on search
  const filteredDevices = devices.filter(d => 
    (d.name || '').toLowerCase().includes(screenSearchQuery.toLowerCase())
  )

  const selectedDevices = devices.filter(d => selectedDeviceIds.includes(d.id))

  return (
    <>
      <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div className={styles.modal} role="dialog">
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>Edit Group</h2>
              <p className={styles.modalSubtitle}>Configure screen membership and default content settings</p>
            </div>
            <button className={styles.modalClose} onClick={onClose} aria-label="Close modal"><X size={18} /></button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Group Name & Color Tag */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup} style={{ flex: 2 }}>
                <label className={styles.label}>Group Name</label>
                <input
                  type="text"
                  maxLength={60}
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Color Tag</label>
                <div className={styles.colorPickerGrid}>
                  {availableColors.map((c) => {
                    const isSelected = color === c
                    return (
                      <div
                        key={c}
                        className={`${styles.colorOption} ${isSelected ? styles.colorOptionSelected : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      >
                        {isSelected && <Check size={12} style={{ color: '#fff' }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Screen Selection Multi-Select Field */}
            <div className={styles.fieldGroup} ref={dropdownRef}>
              <label className={styles.label}>Assigned Screens</label>
              <div 
                className={styles.screensInputTrigger} 
                onClick={() => setShowScreensDropdown(!showScreensDropdown)}
              >
                {selectedDevices.length === 0 ? (
                  <span className={styles.placeholder}>Select screens to assign...</span>
                ) : (
                  <div className={styles.pillsContainer}>
                    {selectedDevices.map(d => (
                      <span key={d.id} className={styles.pill} onClick={(e) => e.stopPropagation()}>
                        <span className={styles.pillText}>{d.name || 'Unnamed Screen'}</span>
                        <button 
                          type="button" 
                          className={styles.removePillBtn} 
                          onClick={() => handleRemoveDevice(d.id)}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {showScreensDropdown && (
                <div className={styles.screensDropdown}>
                  <div className={styles.searchWrapper}>
                    <Search size={14} className={styles.searchIcon} />
                    <input 
                      type="text" 
                      className={styles.dropdownSearch} 
                      placeholder="Filter screens..." 
                      value={screenSearchQuery} 
                      onChange={(e) => setScreenSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()} 
                    />
                  </div>
                  <div className={styles.dropdownList}>
                    {filteredDevices.length === 0 ? (
                      <div className={styles.noResults}>No screens found</div>
                    ) : (
                      filteredDevices.map(d => {
                        const isSelected = selectedDeviceIds.includes(d.id)
                        return (
                          <div 
                            key={d.id} 
                            className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ''}`}
                            onClick={() => handleToggleDevice(d.id)}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => {}} // handled by click
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className={styles.deviceMeta}>
                              <span className={styles.deviceName}>{d.name || 'Unnamed Screen'}</span>
                              <span className={`${styles.statusText} ${d.status === 'online' ? styles.statusOnline : ''}`}>
                                ● {d.status}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content Type */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Content Type</label>
              <select 
                className={styles.input} 
                value={contentType || ''} 
                onChange={(e) => handleContentTypeChange(e.target.value as any)}
              >
                {!contentType && (
                  <option value="" disabled>no content</option>
                )}
                <option value="Asset">Asset</option>
                <option value="Playlist">Playlist</option>
                <option value="Schedule" disabled>Schedule (Coming Soon)</option>
              </select>
            </div>

            {/* Content Selection Details */}
            {contentType === 'Asset' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Selected Asset</label>
                <div 
                  className={styles.customSelectTrigger} 
                  onClick={() => setShowAssetBrowser(true)}
                  tabIndex={0}
                  role="button"
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
                <label className={styles.label}>Selected Playlist</label>
                <div 
                  className={styles.customSelectTrigger} 
                  onClick={() => setShowPlaylistBrowser(true)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlaylistBrowser(true); } }}
                >
                  <span className={selectedPlaylist ? styles.selectedText : styles.placeholderText}>
                    {selectedPlaylist ? selectedPlaylist.name : 'No playlist selected'}
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

            {/* Scale Mode */}
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

            {/* Orientation */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Orientation Override</label>
              <select className={styles.input} value={orientation} onChange={(e) => setOrientation(Number(e.target.value) as 0 | 90 | 180 | 270)}>
                <option value={0}>Landscape (0°)</option>
                <option value={90}>Rotate 90°</option>
                <option value={180}>Rotate 180°</option>
                <option value={270}>Rotate 270°</option>
              </select>
            </div>

            {error && <div className={styles.errorMsg}><AlertTriangle size={16} />{error}</div>}

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </button>
              <button 
                className={styles.submitBtn} 
                type="submit" 
                disabled={isPending || (contentType === 'Asset' && !assetId) || (contentType === 'Playlist' && !playlistId)}
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
