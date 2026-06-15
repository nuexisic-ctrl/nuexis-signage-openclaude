'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { File, Play, Image as ImageIcon, Link, Code, Clock, QrCode, Folder, Hourglass, Tv, Globe, Images, ChevronDown, FileText, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Asset, ScreenDevice, formatBytes, isImage, isVideo, isWidget } from './types'
import { t } from '@/lib/i18n'
import styles from './AssetTableView.module.css'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'

const YoutubeIcon = ({ size = 20, style }: { size?: number; style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={style}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)

function getContentTypeInfo(mimeType: string, isFolder: boolean, folderColor?: string | null) {
  if (isFolder) {
    return {
      label: t('Folder'),
      icon: <Folder size={14} style={{ stroke: folderColor || '#78716c' }} />,
      bgColor: 'rgba(120, 113, 108, 0.08)',
      borderColor: 'rgba(120, 113, 108, 0.15)',
      color: folderColor || '#a8a29e',
    }
  }
  if (mimeType.startsWith('image/')) {
    return {
      label: t('Image'),
      icon: <ImageIcon size={14} />,
      bgColor: 'rgba(34, 197, 94, 0.08)',
      borderColor: 'rgba(34, 197, 94, 0.15)',
      color: '#4ade80',
    }
  }
  if (mimeType.startsWith('video/')) {
    return {
      label: t('Video'),
      icon: <Play size={14} />,
      bgColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.15)',
      color: '#60a5fa',
    }
  }
  if (mimeType.startsWith('audio/')) {
    return {
      label: t('Audio'),
      icon: <Music size={14} />,
      bgColor: 'rgba(234, 179, 8, 0.08)',
      borderColor: 'rgba(234, 179, 8, 0.15)',
      color: '#facc15',
    }
  }
  if (mimeType === 'application/pdf') {
    return {
      label: t('PDF'),
      icon: <FileText size={14} />,
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
    }
  }
  if (mimeType === 'application/x-widget-qrcode') {
    return {
      label: t('QR Code'),
      icon: <QrCode size={14} />,
      bgColor: 'rgba(168, 85, 247, 0.08)',
      borderColor: 'rgba(168, 85, 247, 0.15)',
      color: '#c084fc',
    }
  }
  if (mimeType === 'application/x-widget-youtube' || mimeType === 'application/x-widget-youtube-playlist') {
    return {
      label: t('YouTube'),
      icon: <YoutubeIcon size={14} />,
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
    }
  }
  if (mimeType === 'application/x-widget-remote-url' || mimeType === 'application/x-widget-website') {
    return {
      label: t('Website'),
      icon: <Link size={14} />,
      bgColor: 'rgba(14, 165, 233, 0.08)',
      borderColor: 'rgba(14, 165, 233, 0.15)',
      color: '#38bdf8',
    }
  }
  if (mimeType === 'application/x-widget-html') {
    return {
      label: t('HTML'),
      icon: <Code size={14} />,
      bgColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399',
    }
  }
  if (mimeType === 'application/x-widget-flow') {
    return {
      label: t('Flow'),
      icon: <Clock size={14} />,
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: 'rgba(139, 92, 246, 0.15)',
      color: '#a78bfa',
    }
  }
  if (mimeType === 'application/x-widget-worldclock') {
    return {
      label: t('World Clock'),
      icon: <Globe size={14} />,
      bgColor: 'rgba(244, 63, 94, 0.08)',
      borderColor: 'rgba(244, 63, 94, 0.15)',
      color: '#fb7185',
    }
  }
  if (mimeType === 'application/x-widget-countdown') {
    return {
      label: t('Countdown'),
      icon: <Hourglass size={14} />,
      bgColor: 'rgba(234, 179, 8, 0.08)',
      borderColor: 'rgba(234, 179, 8, 0.15)',
      color: '#facc15',
    }
  }
  if (mimeType === 'application/x-widget-slideshow') {
    return {
      label: t('Slideshow'),
      icon: <Images size={14} />,
      bgColor: 'rgba(236, 72, 153, 0.08)',
      borderColor: 'rgba(236, 72, 153, 0.15)',
      color: '#f472b6',
    }
  }
  return {
    label: t('Document'),
    icon: <File size={14} />,
    bgColor: 'rgba(100, 116, 139, 0.08)',
    borderColor: 'rgba(100, 116, 139, 0.15)',
    color: '#94a3b8',
  }
}

interface AssetTableViewProps {
  filteredAssets: Asset[]
  screens: ScreenDevice[]
  openMenuId: string | null
  menuPosition: { top: number; right: number } | null
  setOpenMenuId: (id: string | null) => void
  setMenuPosition: (pos: { top: number; right: number } | null) => void
  setPreviewAsset: (asset: Asset) => void
  setRenameModalAsset: (asset: Asset) => void
  setDeleteModalAsset: (asset: Asset) => void
  setPushModalAsset: (asset: Asset) => void
  deletingIds: Set<string>
  getPreviewUrl: (filePath: string) => string | null
  selectedAssetIds: Set<string>
  setSelectedAssetIds: (ids: Set<string>) => void
  handleToggleSelect: (id: string) => void
  dragOverFolderId?: string | null
  setDragOverFolderId?: (id: string | null) => void
  onDropOnFolder?: (folder: Asset, draggedAssetIds: string[]) => void
  sortBy?: string
  setSortBy?: (val: string) => void
}

export function AssetTableView({
  filteredAssets,
  screens,
  openMenuId,
  menuPosition,
  setOpenMenuId,
  setMenuPosition,
  setPreviewAsset,
  setRenameModalAsset,
  setDeleteModalAsset,
  setPushModalAsset,
  deletingIds,
  getPreviewUrl,
  selectedAssetIds,
  setSelectedAssetIds,
  handleToggleSelect,
  dragOverFolderId,
  setDragOverFolderId,
  onDropOnFolder,
  sortBy,
  setSortBy,
}: AssetTableViewProps) {
  const supabase = createClient()

  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false)
  const selectDropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside selection dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setIsSelectDropdownOpen(false)
      }
    }
    if (isSelectDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isSelectDropdownOpen])

  const totalCount = filteredAssets.length
  const filesCount = filteredAssets.filter(a => a.mime_type !== 'application/x-folder').length
  const foldersCount = filteredAssets.filter(a => a.mime_type === 'application/x-folder').length

  const getDraggedIds = (asset: Asset, dataTransfer: DataTransfer | null) => {
    // Prefer explicit payload
    if (dataTransfer) {
      try {
        const raw = dataTransfer.getData('application/x-nuexis-asset-ids')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed.filter(Boolean)
        }
      } catch {
        // ignore
      }
    }

    // Fallback to current selection or single
    if (selectedAssetIds.size > 0 && selectedAssetIds.has(asset.id)) {
      return Array.from(selectedAssetIds)
    }
    return [asset.id]
  }

  const handleDownload = async (asset: Asset) => {
    try {
      const { data } = await supabase.storage
        .from('workspace-media')
        .createSignedUrl(asset.file_path, 60, {
          download: asset.file_name,
        })
      if (data?.signedUrl) {
        window.location.href = data.signedUrl
      }
    } catch (err) {
      console.error('Failed to download asset:', err)
    }
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.screensTable}>
        <thead className={styles.tableHeader}>
          <tr>
            <th style={{ width: '58px', textAlign: 'center', padding: '14px 8px' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '2px', 
                  position: 'relative' 
                }} 
                ref={selectDropdownRef}
              >
                <input 
                  type="checkbox" 
                  checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssetIds.has(a.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAssetIds(new Set(filteredAssets.map(a => a.id)))
                    } else {
                      setSelectedAssetIds(new Set())
                    }
                  }}
                  aria-label={t('Select all items on this page')}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSelectDropdownOpen(!isSelectDropdownOpen)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--on-surface-subtle)',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <ChevronDown size={14} />
                </button>

                {isSelectDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      background: 'var(--surface-lowest)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-modal)',
                      padding: '6px',
                      zIndex: 200,
                      minWidth: '200px',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetIds(new Set(filteredAssets.map(a => a.id)))
                        setIsSelectDropdownOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 0,
                        borderRadius: '6px',
                        background: 'transparent',
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        transition: 'background 0.15s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {t('Select All')} ({totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetIds(new Set(filteredAssets.filter(a => a.mime_type !== 'application/x-folder').map(a => a.id)))
                        setIsSelectDropdownOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 0,
                        borderRadius: '6px',
                        background: 'transparent',
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        transition: 'background 0.15s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {t('Select Files Only')} ({filesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetIds(new Set(filteredAssets.filter(a => a.mime_type === 'application/x-folder').map(a => a.id)))
                        setIsSelectDropdownOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 0,
                        borderRadius: '6px',
                        background: 'transparent',
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        transition: 'background 0.15s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-low)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {t('Select Folders Only')} ({foldersCount})
                    </button>
                    <div style={{ height: '1px', background: 'var(--outline-variant)', margin: '4px 6px' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetIds(new Set())
                        setIsSelectDropdownOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        border: 0,
                        borderRadius: '6px',
                        background: 'transparent',
                        color: 'var(--error)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        transition: 'background 0.15s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--error-container)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {t('Deselect All')}
                    </button>
                  </div>
                )}
              </div>
            </th>
            <th 
              style={{ width: 'auto', cursor: setSortBy ? 'pointer' : 'default', userSelect: 'none' }}
              onClick={() => {
                if (setSortBy && sortBy) {
                  setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')
                }
              }}
            >
              {t('File Name')}
              {sortBy === 'name-asc' && ' ▲'}
              {sortBy === 'name-desc' && ' ▼'}
            </th>
            <th 
              style={{ width: '135px', cursor: setSortBy ? 'pointer' : 'default', userSelect: 'none', textAlign: 'center' }}
              onClick={() => {
                if (setSortBy && sortBy) {
                  setSortBy(sortBy === 'type-asc' ? 'type-desc' : 'type-asc')
                }
              }}
            >
              {t('Content Type')}
              {sortBy === 'type-asc' && ' ▲'}
              {sortBy === 'type-desc' && ' ▼'}
            </th>
            <th 
              style={{ width: '130px', cursor: setSortBy ? 'pointer' : 'default', userSelect: 'none' }}
              onClick={() => {
                if (setSortBy && sortBy) {
                  setSortBy(sortBy === 'created-asc' ? 'created-desc' : 'created-asc')
                }
              }}
            >
              {t('Date Added')}
              {sortBy === 'created-asc' && ' ▲'}
              {sortBy === 'created-desc' && ' ▼'}
            </th>
            <th style={{ width: '90px', textAlign: 'right' }}>{t('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssets.map((asset) => {
            const isMenuOpen = openMenuId === asset.id
            const date = new Date(asset.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            const isFolder = asset.mime_type === 'application/x-folder'

            return (
              <tr
                key={asset.id}
                className={`${styles.tableRow} ${selectedAssetIds.has(asset.id) ? styles.rowSelected : ''} ${
                  isFolder && dragOverFolderId === asset.id ? styles.dropTargetRow : ''
                }`}
                draggable={!isFolder && !deletingIds.has(asset.id)}
                onDragStart={(e) => {
                  if (isFolder || deletingIds.has(asset.id)) return
                  const ids = getDraggedIds(asset, e.dataTransfer)
                  e.dataTransfer.setData('application/x-nuexis-asset-ids', JSON.stringify(ids))
                  e.dataTransfer.setData('text/plain', ids.join(','))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setDragOverFolderId?.(null)}
                onDragOver={(e) => {
                  if (!isFolder) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverFolderId?.(asset.id)
                }}
                onDrop={(e) => {
                  if (!isFolder) return
                  e.preventDefault()
                  setDragOverFolderId?.(null)
                  if (!onDropOnFolder) return

                  let ids: string[] = []
                  try {
                    const raw = e.dataTransfer.getData('application/x-nuexis-asset-ids') || '[]'
                    ids = JSON.parse(raw)
                  } catch {
                    ids = (e.dataTransfer.getData('text/plain') || '')
                      .split(',')
                      .map(x => x.trim())
                      .filter(Boolean)
                  }
                  const sanitized = ids.filter(id => id && id !== asset.id)
                  if (sanitized.length === 0) return
                  onDropOnFolder(asset, sanitized)
                }}
                onClick={() => {
                  if (selectedAssetIds.size > 0) {
                    handleToggleSelect(asset.id)
                  } else {
                    setPreviewAsset(asset)
                  }
                }}
              >
                <td 
                  className={styles.tableCell} 
                  style={{ width: '58px', textAlign: 'center', cursor: 'pointer', padding: '14px 8px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleSelect(asset.id)
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedAssetIds.has(asset.id)} 
                    readOnly
                    aria-label={`${selectedAssetIds.has(asset.id) ? t('Deselect') : t('Select')} ${asset.file_name}`}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', pointerEvents: 'none' }}
                  />
                </td>
                <td
                  className={styles.tableCell}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedAssetIds.size > 0) {
                      handleToggleSelect(asset.id)
                    } else {
                      setPreviewAsset(asset)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.nameCellContent}>
                    <div className={styles.deviceIconWrapper}>
                      {isFolder ? (
                        <Folder size={20} style={{ stroke: asset.color || '#78716c', color: asset.color || '#78716c' }} />
                      ) : isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode' ? (
                        getPreviewUrl(asset.file_path) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getPreviewUrl(asset.file_path)!} className={styles.tableThumbnail} alt="" />
                        ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                          <QrCode size={20} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                        ) : (
                          <ImageIcon size={20} />
                        )
                      ) : isVideo(asset.mime_type) ? (
                        getPreviewUrl(asset.file_path) ? (
                          <video src={getPreviewUrl(asset.file_path)! + '#t=0.001'} className={styles.tableThumbnail} preload="metadata" muted playsInline />
                        ) : (
                          <Play size={20} />
                        )
                      ) : asset.mime_type === 'application/x-widget-youtube' || asset.mime_type === 'application/x-widget-youtube-playlist' ? (
                        <YoutubeIcon size={20} style={{ stroke: '#ff0000', color: '#ff0000' }} />
                      ) : asset.mime_type === 'application/x-widget-remote-url' || asset.mime_type === 'application/x-widget-website' ? (
                        <Link size={20} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
                      ) : asset.mime_type === 'application/x-widget-html' ? (
                        <Code size={20} style={{ stroke: '#10b981', color: '#10b981' }} />
                      ) : asset.mime_type === 'application/x-widget-flow' ? (
                        <Clock size={20} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
                      ) : asset.mime_type === 'application/x-widget-worldclock' ? (
                        <Globe size={20} style={{ stroke: '#f43f5e', color: '#f43f5e' }} />
                      ) : asset.mime_type === 'application/x-widget-countdown' ? (
                        <Hourglass size={20} style={{ stroke: '#eab308', color: '#eab308' }} />
                      ) : asset.mime_type === 'application/x-widget-slideshow' ? (
                        <Images size={20} style={{ stroke: '#ec4899', color: '#ec4899' }} />
                      ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                        <QrCode size={20} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                      ) : (
                        <File size={20} />
                      )}
                    </div>
                    <div className={styles.cellName}>
                      <FilenameTruncator filename={asset.file_name} />
                    </div>
                  </div>
                </td>

                <td
                  className={styles.tableCell}
                  style={{ fontSize: '0.88rem', color: 'var(--on-surface-subtle)', textAlign: 'center' }}
                >
                  {(() => {
                    const info = getContentTypeInfo(asset.mime_type, isFolder, asset.color)
                    return (
                      <div 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          backgroundColor: info.bgColor,
                          border: `1px solid ${info.borderColor}`,
                          color: info.color,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          lineHeight: 1,
                          userSelect: 'none',
                        }} 
                        title={info.label}
                        aria-label={info.label}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {info.icon}
                        </span>
                        <span>{info.label}</span>
                      </div>
                    )
                  })()}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.cellLastSeen}>{date}</div>
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionsGroup}>
                    {!isFolder && (
                      <button
                        className={styles.actionBtnBox}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPushModalAsset(asset)
                        }}
                        title={t('Push to screen')}
                        aria-label="Push to screen"
                        type="button"
                      >
                        <Tv size={16} />
                      </button>
                    )}
                    <div className={styles.moreMenuWrapper}>
                      <button
                        className={`${styles.actionBtnBox} ${
                          isMenuOpen ? styles.active : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isMenuOpen) {
                            setOpenMenuId(null)
                            setMenuPosition(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const right = Math.max(8, window.innerWidth - rect.right)
                            setMenuPosition({
                              top: rect.bottom + window.scrollY + 6,
                              right,
                            })
                            setOpenMenuId(asset.id)
                          }
                        }}
                        disabled={deletingIds.has(asset.id)}
                        aria-label="More Actions"
                        type="button"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          width="18"
                          height="18"
                        >
                          <circle cx="12" cy="12" r="1.5"></circle>
                          <circle cx="12" cy="5" r="1.5"></circle>
                          <circle cx="12" cy="19" r="1.5"></circle>
                        </svg>
                      </button>
                      {isMenuOpen &&
                        menuPosition &&
                        typeof window !== 'undefined' &&
                        createPortal(
                          <div
                            className={styles.moreDropdown}
                            style={{
                              position: 'absolute',
                              top: menuPosition.top,
                              right: menuPosition.right,
                              zIndex: 100000,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isWidget(asset.mime_type) && asset.mime_type !== 'application/x-widget-qrcode' && (
                              <button
                                className={styles.dropdownItem}
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setPreviewAsset(asset)
                                }}
                              >
                                {t('Edit Widget')}
                              </button>
                            )}
                            <button
                              className={styles.dropdownItem}
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                setRenameModalAsset(asset)
                              }}
                            >
                              {t('Rename')}
                            </button>
                            {!isWidget(asset.mime_type) && !isFolder && (
                              <button
                                className={styles.dropdownItem}
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handleDownload(asset)
                                }}
                              >
                                {t('Download')}
                              </button>
                            )}

                            <button
                              className={`${styles.dropdownItem} ${styles.danger}`}
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                setDeleteModalAsset(asset)
                              }}
                            >
                              {t('Delete Asset')}
                            </button>
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
