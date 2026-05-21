'use client'

import { createPortal } from 'react-dom'
import { File, Play, Image as ImageIcon } from 'lucide-react'
import styles from './AssetTableView.module.css'

import { Asset, formatBytes, isImage, isVideo, isWidget } from './types'

interface AssetTableViewProps {
  filteredAssets: Asset[]
  openMenuId: string | null
  menuPosition: { top: number; right: number } | null
  setOpenMenuId: (id: string | null) => void
  setMenuPosition: (pos: { top: number; right: number } | null) => void
  setPreviewAsset: (asset: Asset) => void
  setRenameModalAsset: (asset: Asset) => void
  setDeleteModalAsset: (asset: Asset) => void
  deletingIds: Set<string>
}

export function AssetTableView({
  filteredAssets,
  openMenuId,
  menuPosition,
  setOpenMenuId,
  setMenuPosition,
  setPreviewAsset,
  setRenameModalAsset,
  setDeleteModalAsset,
  deletingIds,
}: AssetTableViewProps) {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.screensTable}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>File Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Date Added</th>
            <th>Actions</th>
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

            return (
              <tr key={asset.id} className={styles.tableRow}>
                <td
                  className={styles.tableCell}
                  onClick={() => setPreviewAsset(asset)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.nameCellContent}>
                    <div className={styles.deviceIconWrapper}>
                      {isImage(asset.mime_type) ? (
                        <ImageIcon size={20} />
                      ) : isVideo(asset.mime_type) ? (
                        <Play size={20} />
                      ) : (
                        <File size={20} />
                      )}
                    </div>
                    <div className={styles.cellName}>{asset.file_name}</div>
                  </div>
                </td>
                <td className={styles.tableCell}>
                  <div
                    className={styles.mimeChip}
                    style={{
                      position: 'relative',
                      bottom: 'auto',
                      left: 'auto',
                      display: 'inline-block',
                    }}
                  >
                    {isWidget(asset.mime_type)
                      ? 'WIDGET'
                      : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
                  </div>
                </td>
                <td
                  className={styles.tableCell}
                  style={{ fontSize: '0.88rem', color: 'var(--on-surface)' }}
                >
                  {formatBytes(asset.size_bytes)}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.cellLastSeen}>{date}</div>
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionsGroup}>
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
                            setMenuPosition({
                              top: rect.bottom + window.scrollY + 6,
                              right: window.innerWidth - rect.right,
                            })
                            setOpenMenuId(asset.id)
                          }
                        }}
                        disabled={deletingIds.has(asset.id)}
                        aria-label="More Actions"
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
                            <button
                              className={styles.dropdownItem}
                              onClick={() => {
                                setOpenMenuId(null)
                                setRenameModalAsset(asset)
                              }}
                            >
                              Rename
                            </button>
                            <button
                              className={`${styles.dropdownItem} ${styles.danger}`}
                              onClick={() => {
                                setOpenMenuId(null)
                                setDeleteModalAsset(asset)
                              }}
                            >
                              Delete Asset
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
