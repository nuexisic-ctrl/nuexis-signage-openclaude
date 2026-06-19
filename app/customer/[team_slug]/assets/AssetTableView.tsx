'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Tv } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Asset, ScreenDevice, formatBytes, isImage, isVideo, isWidget } from './types'
import { useTranslation } from '@/lib/i18n'
import styles from './AssetTableView.module.css'
import { ContentIconBadge, getAssetKind, ContentIcon } from '../screens/DeviceIcon'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { downloadAsset } from '@/lib/utils/download'

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
  onItemClick?: (e: React.MouseEvent, id: string) => void
  onItemDoubleClick?: (asset: Asset) => void
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
  onItemClick,
  onItemDoubleClick,
}: AssetTableViewProps) {
  const { t, formatDate } = useTranslation()
  const supabase = createClient()



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

  const handleDownload = (asset: Asset) => {
    downloadAsset(asset.file_path, asset.file_name)
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.screensTable}>
        <thead className={styles.tableHeader}>
          <tr>
            <th style={{ width: '58px', textAlign: 'center', padding: '14px 8px' }} />
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
              style={{ width: '80px', cursor: setSortBy ? 'pointer' : 'default', userSelect: 'none' }}
              onClick={() => {
                if (setSortBy && sortBy) {
                  setSortBy(sortBy === 'type-asc' ? 'type-desc' : 'type-asc')
                }
              }}
            >
              {t('Type')}
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
            const date = formatDate(asset.created_at)
            const isFolder = asset.mime_type === 'application/x-folder'

            return (
              <tr
                key={asset.id}
                className={`${styles.tableRow} ${selectedAssetIds.has(asset.id) ? styles.rowSelected : ''} ${
                  isFolder && dragOverFolderId === asset.id ? styles.dropTargetRow : ''
                }`}
                tabIndex={0}
                role="button"
                aria-label={isFolder ? `Open folder ${asset.file_name}` : `Preview asset ${asset.file_name}`}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault()
                    handleToggleSelect(asset.id)
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    onItemDoubleClick?.(asset)
                  }
                }}
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
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('button') ||
                    target.closest('input') ||
                    target.closest('select') ||
                    (target.closest('[role="button"]') && target.closest('[role="button"]') !== e.currentTarget) ||
                    target.closest(`.${styles.moreDropdown}`)
                  ) {
                    return;
                  }
                  onItemClick?.(e, asset.id);
                }}
                onDoubleClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('button') ||
                    target.closest('input') ||
                    target.closest('select') ||
                    target.closest(`.${styles.moreDropdown}`)
                  ) {
                    return;
                  }
                  onItemDoubleClick?.(asset);
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
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.nameCellContent}>
                    <div className={styles.deviceIconWrapper}>
                      {isFolder ? (
                        <ContentIcon kind="folder" size={20} style={{ stroke: asset.color || '#78716c', fill: asset.color || '#78716c', fillOpacity: 0.15 }} />
                      ) : isImage(asset.mime_type) && getPreviewUrl(asset.file_path) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getPreviewUrl(asset.file_path)!} className={styles.tableThumbnail} alt={asset.file_name} />
                      ) : isVideo(asset.mime_type) && getPreviewUrl(asset.file_path) ? (
                        <video src={getPreviewUrl(asset.file_path)! + '#t=0.001'} className={styles.tableThumbnail} preload="metadata" muted playsInline />
                      ) : (
                        <ContentIcon 
                          kind={getAssetKind(asset.mime_type)} 
                          size={20} 
                          style={
                            asset.mime_type === 'application/x-widget-youtube' || asset.mime_type === 'application/x-widget-youtube-playlist'
                              ? { stroke: '#ff0000', color: '#ff0000' }
                              : asset.mime_type === 'application/x-widget-remote-url' || asset.mime_type === 'application/x-widget-website'
                              ? { stroke: '#0ea5e9', color: '#0ea5e9' }
                              : asset.mime_type === 'application/x-widget-html'
                              ? { stroke: '#10b981', color: '#10b981' }
                              : asset.mime_type === 'application/x-widget-flow'
                              ? { stroke: '#8b5cf6', color: '#8b5cf6' }
                              : asset.mime_type === 'application/x-widget-worldclock'
                              ? { stroke: '#f43f5e', color: '#f43f5e' }
                              : asset.mime_type === 'application/x-widget-countdown'
                              ? { stroke: '#eab308', color: '#eab308' }
                              : asset.mime_type === 'application/x-widget-slideshow'
                              ? { stroke: '#ec4899', color: '#ec4899' }
                              : asset.mime_type === 'application/x-widget-qrcode'
                              ? { stroke: '#a855f7', color: '#a855f7' }
                              : undefined
                          }
                        />
                      )}
                    </div>
                    <div className={styles.cellName}>
                      <FilenameTruncator filename={asset.file_name} />
                    </div>
                  </div>
                </td>

                <td
                  className={styles.tableCell}
                  style={{ fontSize: '0.88rem', color: 'var(--on-surface-subtle)' }}
                >
                  <ContentIconBadge
                    kind={getAssetKind(asset.mime_type)}
                    color={asset.mime_type === 'application/x-folder' ? (asset.color || '#78716c') : null}
                  />
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
                        <Tv aria-hidden="true" size={16} />
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
                          aria-hidden="true"
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
