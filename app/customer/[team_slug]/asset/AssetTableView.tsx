'use client'

import { createPortal } from 'react-dom'
import { File, Play, Image as ImageIcon, Link, Code, Clock, QrCode, Folder, Hourglass, Tv, Globe } from 'lucide-react'
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
}: AssetTableViewProps) {
  const supabase = createClient()

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
            <th style={{ width: '40px', textAlign: 'center' }}>
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
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </th>
            <th style={{ width: '35%' }}>{t('File Name')}</th>
            <th style={{ width: '15%' }}>{t('Type')}</th>
            <th style={{ width: '15%' }}>{t('Screens')}</th>
            <th style={{ width: '25%' }}>{t('Date Added')}</th>
            <th style={{ width: '10%', textAlign: 'right' }}>{t('Actions')}</th>
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
                  style={{ width: '40px', textAlign: 'center', cursor: 'pointer' }}
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
                      ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                        <Link size={20} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
                      ) : asset.mime_type === 'application/x-widget-html' ? (
                        <Code size={20} style={{ stroke: '#10b981', color: '#10b981' }} />
                      ) : asset.mime_type === 'application/x-widget-flow' ? (
                        <Clock size={20} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
                      ) : asset.mime_type === 'application/x-widget-worldclock' ? (
                        <Globe size={20} style={{ stroke: '#f43f5e', color: '#f43f5e' }} />
                      ) : asset.mime_type === 'application/x-widget-website' ? (
                        <Globe size={20} style={{ stroke: '#10b981', color: '#10b981' }} />
                      ) : asset.mime_type === 'application/x-widget-countdown' ? (
                        <Hourglass size={20} style={{ stroke: '#eab308', color: '#eab308' }} />
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
                <td className={styles.tableCell}>
                  <div 
                    className={styles.contentIconWrap}
                    title={isFolder ? 'FOLDER' : asset.mime_type === 'application/x-widget-flow' ? 'CLOCK' : asset.mime_type === 'application/x-widget-worldclock' ? 'WORLD CLOCK' : asset.mime_type === 'application/x-widget-countdown' ? 'COUNTDOWN' : asset.mime_type === 'application/x-widget-website' ? 'WEBSITE' : isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
                  >
                    {isFolder ? (
                      <Folder size={15} />
                    ) : isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode' ? (
                      asset.mime_type === 'application/x-widget-qrcode' ? (
                        <QrCode size={15} />
                      ) : (
                        <ImageIcon size={15} />
                      )
                    ) : isVideo(asset.mime_type) ? (
                      <Play size={15} />
                    ) : asset.mime_type === 'application/x-widget-youtube' || asset.mime_type === 'application/x-widget-youtube-playlist' ? (
                      <YoutubeIcon size={15} />
                    ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                      <Link size={15} />
                    ) : asset.mime_type === 'application/x-widget-html' ? (
                      <Code size={15} />
                    ) : asset.mime_type === 'application/x-widget-flow' ? (
                      <Clock size={15} />
                    ) : asset.mime_type === 'application/x-widget-worldclock' ? (
                      <Globe size={15} />
                    ) : asset.mime_type === 'application/x-widget-website' ? (
                      <Globe size={15} />
                    ) : asset.mime_type === 'application/x-widget-countdown' ? (
                      <Hourglass size={15} />
                    ) : (
                      <File size={15} />
                    )}
                  </div>
                </td>
                <td
                  className={styles.tableCell}
                  style={{ fontSize: '0.88rem', color: 'var(--on-surface-subtle)' }}
                >
                  {(() => {
                    if (isFolder) return '—'
                    const usageScreens = screens.filter(s => s.asset_id === asset.id)
                    if (usageScreens.length === 0) return 'Unused'
                    return (
                      <span className={styles.screenNames} title={usageScreens.map(s => s.name).join(', ')}>
                        {usageScreens.length === 1 ? usageScreens[0].name : `${usageScreens.length} screens`}
                      </span>
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
