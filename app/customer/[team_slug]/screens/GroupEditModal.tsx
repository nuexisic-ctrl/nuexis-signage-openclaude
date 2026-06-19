'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { Check, AlertTriangle, Monitor, Search, Tv } from 'lucide-react'
import styles from './GroupEditModal.module.css'
import { Asset, Playlist, Device } from './types'
import { saveGroupChanges } from '../groups/actions'
import { AssetBrowserModal } from '../components/AssetBrowser'
import { PlaylistBrowserModal } from './PlaylistBrowserModal'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'

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
  teamId: string
  onClose: () => void
  onSuccess: () => void
}

import { PRESET_COLORS } from '@/lib/utils/constants'

export function GroupEditModal({
  group,
  devices,
  memberships,
  assets,
  playlists,
  teamSlug,
  teamId,
  onClose,
  onSuccess,
}: GroupEditModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color || PRESET_COLORS[0])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const availableColors = PRESET_COLORS

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

  const selectedAsset = assets.find(a => a.id === assetId)
  const selectedPlaylist = playlists.find(p => p.id === playlistId)

  // Scroll containment & modalStack registration
  useEffect(() => {
    modalStack.push('group-edit-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('group-edit-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Close modal/dropdown on Escape key press based on stack priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showScreensDropdown) {
          setShowScreensDropdown(false)
        } else if (modalStack.isTop('group-edit-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showScreensDropdown, onClose])

  // Handle click-outside for screens dropdown on document level
  useEffect(() => {
    if (!showScreensDropdown) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTimeout(() => {
          setShowScreensDropdown(false)
        }, 120)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showScreensDropdown])

  // Close color picker popover on outside click
  useEffect(() => {
    if (!showColorPicker) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setTimeout(() => {
          setShowColorPicker(false)
        }, 120)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showColorPicker])

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



  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t('Group name is required.'))
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
        scale_mode: scaleMode,
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
        setError(result.error || t('Failed to save group changes.'))
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
      <Modal
        isOpen={true}
        onClose={onClose}
        title={t('Edit Group')}
        subtitle={t('Configure screen membership and default content settings')}
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Group Name & Color Tag */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('Group Name')}</label>
            <div className={styles.inputWithColorContainer}>
              <input
                type="text"
                maxLength={60}
                className={styles.inputWithColor}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
              <button
                type="button"
                className={styles.colorIndicatorDot}
                style={{ backgroundColor: color }}
                onClick={() => setShowColorPicker(!showColorPicker)}
                title={t('Select Group Color')}
                aria-label={t('Select Group Color')}
              />
              {showColorPicker && (
                <div className={styles.colorPickerPopover} ref={colorPickerRef}>
                  <div className={styles.popoverHeader}>
                    <span className={styles.popoverTitle}>{t('Select Color')}</span>
                    <button 
                      type="button" 
                      className={styles.popoverCloseBtn} 
                      onClick={() => setShowColorPicker(false)}
                    >
                      X
                    </button>
                  </div>
                  
                  <div className={styles.predefinedColorsGrid}>
                    {availableColors.map((c) => {
                      const isSelected = color === c
                      return (
                        <button
                          type="button"
                          key={c}
                          className={`${styles.colorOptionBubble} ${isSelected ? styles.colorOptionBubbleSelected : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setColor(c)
                            setShowColorPicker(false)
                          }}
                        >
                          {isSelected && <Check size={10} style={{ color: c === '#ffffff' ? '#000' : '#fff' }} />}
                        </button>
                      )
                    })}
                  </div>
                  
                  <div className={styles.customColorSection}>
                    <label className={styles.customColorLabel}>{t('Custom Color')}</label>
                    <div className={styles.customColorRow}>
                      <input
                        type="color"
                        className={styles.customColorInput}
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                      <input
                        type="text"
                        className={styles.customColorHexInput}
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screen Selection Multi-Select Field */}
          <div className={styles.fieldGroup} ref={dropdownRef}>
            <label className={styles.label}>{t('Assigned Screens')}</label>
            <div 
              className={styles.screensInputTrigger} 
              onClick={() => setShowScreensDropdown(!showScreensDropdown)}
            >
              {selectedDevices.length === 0 ? (
                <span className={styles.placeholder}>{t('Select screens to assign...')}</span>
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
                        X
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
                    placeholder={t('Filter screens...')} 
                    value={screenSearchQuery} 
                    onChange={(e) => setScreenSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                  />
                </div>
                <div className={styles.dropdownList}>
                  {filteredDevices.length === 0 ? (
                    <div className={styles.noResults}>{t('No screens found')}</div>
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
                              ● {t(d.status)}
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
            <label className={styles.label}>{t('Content Type')}</label>
            <CustomSelect
              id="group-edit-content-type"
              value={contentType || ''}
              onChange={(val) => handleContentTypeChange(val as 'Asset' | 'Playlist' | 'Schedule' | '')}
              options={[
                ...(!contentType ? [{ value: '', label: t('no content'), disabled: true }] : []),
                { value: 'Asset', label: t('Asset') },
                { value: 'Playlist', label: t('Playlist') },
                { value: 'Schedule', label: t('Schedule (Coming Soon)'), disabled: true }
              ]}
            />
          </div>

          {/* Content Selection Details */}
          {contentType === 'Asset' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t('Selected Asset')}</label>
              <div 
                className={styles.customSelectTrigger} 
                onClick={() => setShowAssetBrowser(true)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAssetBrowser(true); } }}
              >
                <span className={selectedAsset ? styles.selectedText : styles.placeholderText}>
                  {selectedAsset ? selectedAsset.file_name : t('No asset selected')}
                </span>
                <button 
                  type="button" 
                  className={styles.browseButton}
                  onClick={(e) => { e.stopPropagation(); setShowAssetBrowser(true); }}
                >
                  {t('Browse')}
                </button>
              </div>
            </div>
          )}

          {contentType === 'Playlist' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t('Selected Playlist')}</label>
              <div 
                className={styles.customSelectTrigger} 
                onClick={() => setShowPlaylistBrowser(true)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlaylistBrowser(true); } }}
              >
                <span className={selectedPlaylist ? styles.selectedText : styles.placeholderText}>
                  {selectedPlaylist ? selectedPlaylist.name : t('No playlist selected')}
                </span>
                <button 
                  type="button" 
                  className={styles.browseButton}
                  onClick={(e) => { e.stopPropagation(); setShowPlaylistBrowser(true); }}
                >
                  {t('Browse')}
                </button>
              </div>
            </div>
          )}

          {/* Scale Mode */}
          {!(contentType === 'Playlist' || (contentType === 'Asset' && selectedAsset?.mime_type?.startsWith('application/x-widget') && selectedAsset?.mime_type !== 'application/x-widget-qrcode')) && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t('Scale Mode')}</label>
              <CustomSelect
                id="group-edit-scale-mode"
                value={scaleMode}
                onChange={(val) => setScaleMode(val)}
                options={[
                  { value: 'None', label: t('None') },
                  { value: 'Fit', label: t('Fit') },
                  { value: 'Stretch', label: t('Stretch') },
                  { value: 'Zoom', label: t('Zoom') }
                ]}
              />
            </div>
          )}

          {/* Orientation */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('Orientation Override')}</label>
            <CustomSelect
              id="group-edit-orientation"
              value={orientation}
              onChange={(val) => setOrientation(Number(val) as 0 | 90 | 180 | 270)}
              options={[
                { value: 0, label: t('Landscape (0°)') },
                { value: 90, label: t('Rotate 90°') },
                { value: 180, label: t('Rotate 180°') },
                { value: 270, label: t('Rotate 270°') }
              ]}
            />
          </div>

          {error && <div className={styles.errorMsg}><AlertTriangle size={16} />{error}</div>}

          <div className={styles.modalFooter}>
            <button 
              type="button" 
              className={styles.btnSecondary} 
              onClick={onClose}
              disabled={isPending}
            >
              {t('Cancel')}
            </button>
            <button 
              className={styles.submitBtn} 
              type="submit" 
              disabled={isPending || (contentType === 'Asset' && !assetId) || (contentType === 'Playlist' && !playlistId)}
            >
              {isPending ? t('Saving…') : t('Save Changes')}
            </button>
          </div>
        </form>
      </Modal>

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
