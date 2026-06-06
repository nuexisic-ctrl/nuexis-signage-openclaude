'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Folder, X, ChevronLeft, ChevronRight, ArrowUpLeft, Trash2, Play, Image as ImageIcon, File, QrCode, Link as LinkIcon, Code, Clock, Eye, Download, Hourglass } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import { Asset, formatBytes, isImage, isVideo, isWidget } from '../../types'
import { deleteAsset, updateAssetName, deleteAssetsBulk, moveAssetsToFolder } from '../../actions'
import { RenameAssetModal, DeleteAssetModal } from '../../ActionModals'
import { BulkDeleteModal } from '../../BulkDeleteModal'
import { AssetPreviewModal } from '../../AssetPreviewModal'
import { t } from '@/lib/i18n'
import styles from '../../asset.module.css'
import tableStyles from '../../AssetTableView.module.css'
import { toast } from '@/app/components/Toast'

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

interface FolderClientProps {
  folder: Asset
  initialAssets: Asset[]
  teamId: string
  teamSlug: string
}

export default function FolderClient({
  folder,
  initialAssets,
  teamId,
  teamSlug,
}: FolderClientProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // Modals state
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [renameModalAsset, setRenameModalAsset] = useState<Asset | null>(null)
  const [deleteModalAsset, setDeleteModalAsset] = useState<Asset | null>(null)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  // Menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccessPulse, setShowSuccessPulse] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Click outside menu closer
  useEffect(() => {
    const handleClick = () => {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  // Preview URLs resolution
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    const generateUrls = async () => {
      const targetAssets = assets.map(asset => {
        if (asset.mime_type === 'application/x-widget-qrcode') {
          try {
            const config = JSON.parse(asset.file_path)
            return { originalPath: asset.file_path, filePathToSign: config.png_path }
          } catch {
            return null
          }
        }
        if ((isImage(asset.mime_type) || isVideo(asset.mime_type)) && !asset.mime_type.startsWith('application/x-widget')) {
          return { originalPath: asset.file_path, filePathToSign: asset.file_path }
        }
        return null
      }).filter(Boolean) as { originalPath: string, filePathToSign: string }[]

      const results = await Promise.all(
        targetAssets.map(async (item) => {
          const url = await getCachedSignedUrl(supabase, item.filePathToSign, 3600)
          return { path: item.originalPath, url }
        })
      )
      if (cancelled) return

      const newUrls = new Map<string, string>()
      for (const res of results) {
        if (res.url) newUrls.set(res.path, res.url)
      }
      setPreviewUrls(prev => {
        const next = new Map(prev)
        newUrls.forEach((val, key) => next.set(key, val))
        return next
      })
    }
    generateUrls()
    return () => { cancelled = true }
  }, [assets, supabase])

  const getPreviewUrl = (filePath: string) => {
    return previewUrls.get(filePath) || null
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

  // Toggle selection
  const handleToggleSelect = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }

  // Single Move to Root
  const handleMoveToRoot = (assetId: string) => {
    const assetName = assets.find(a => a.id === assetId)?.file_name || t('item')
    startTransition(async () => {
      const result = await moveAssetsToFolder(teamSlug, [assetId], null)
      if (result.success) {
        setAssets(prev => prev.filter(a => a.id !== assetId))
        setSelectedAssetIds(prev => {
          const next = new Set(prev)
          next.delete(assetId)
          return next
        })
        toast.success(`${t('Moved')} "${assetName}" ${t('to Root')}`)
        router.refresh()
      } else {
        toast.error(result.error || t('Failed to move asset.'))
      }
    })
  }

  // Bulk Move to Root
  const handleBulkMoveToRoot = () => {
    const count = selectedAssetIds.size
    startTransition(async () => {
      const assetIds = Array.from(selectedAssetIds)
      const result = await moveAssetsToFolder(teamSlug, assetIds, null)
      if (result.success) {
        setAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)))
        setSelectedAssetIds(new Set())
        toast.success(`${t('Moved')} ${count} ${count === 1 ? t('item') : t('items')} ${t('to Root')}`)
        router.refresh()
      } else {
        toast.error(result.error || t('Failed to move assets.'))
      }
    })
  }

  const handleDeleteSuccess = (assetId: string) => {
    setAssets(prev => prev.filter(a => a.id !== assetId))
    setDeleteModalAsset(null)
    setDeletingIds(prev => {
      const next = new Set(prev)
      next.delete(assetId)
      return next
    })
  }

  const handleRenameAssetSuccess = (newName: string) => {
    setAssets(prev => prev.map(a => a.id === renameModalAsset?.id ? { ...a, file_name: newName } : a))
    setRenameModalAsset(null)
  }

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets
    return assets.filter(a => a.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [assets, searchQuery])

  const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = filteredAssets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredAssets.length)

  const paginatedAssets = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return filteredAssets.slice(from, from + pageSize)
  }, [filteredAssets, currentPage, pageSize])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return (
    <div className={styles.assetArea}>
      {/* Header Breadcrumbs */}
      <div className={styles.topbar}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.94rem', color: 'var(--on-surface-subtle)', fontWeight: 600 }}>
            <Link href={`/customer/${teamSlug}/asset`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              All items
            </Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--on-surface)' }}>
              <Folder size={16} style={{ stroke: folder.color || '#78716c', fill: folder.color || '#78716c', fillOpacity: 0.15 }} />
              {folder.file_name}
            </span>
          </div>
          <h1 className={styles.pageTitle} style={{ marginTop: '6px' }}>{folder.file_name}</h1>
        </div>
      </div>

      {/* Main Blocks */}
      <div className={styles.pageLayout}>
        <div className={styles.mainContent}>
          <div className={styles.mainBlockContainer}>
            {/* Control Bar */}
            <div className={styles.controlsBar}>
              <div className={styles.searchBox}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  className={styles.searchInput}
                  placeholder={t('Search files inside folder...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className={styles.controlsRight}>
                {selectedAssetIds.size > 0 && (
                  <div className={styles.selectedActionsContainer}>
                    <div className={styles.selectedCountBadge}>
                      <span className={styles.selectedCountNumber}>{selectedAssetIds.size}</span>
                      <span className={styles.selectedCountText}>
                        {selectedAssetIds.size === 1 ? t('asset selected') : t('assets selected')}
                      </span>
                    </div>
                    <button
                      className={styles.bulkActionIconBtn}
                      onClick={handleBulkMoveToRoot}
                      title={t('Move out of Folder')}
                    >
                      <ArrowUpLeft size={16} />
                    </button>
                    <button
                      className={`${styles.bulkActionIconBtn} ${styles.bulkActionIconBtnDanger}`}
                      onClick={() => setShowBulkDeleteModal(true)}
                      title={t('Delete Selected Assets')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table View */}
            {filteredAssets.length === 0 ? (
              <div className={styles.emptyState} style={{ minHeight: '260px' }}>
                <div className={styles.emptyIcon}><Folder size={28} style={{ stroke: folder.color || '#78716c' }} /></div>
                <h3 className={styles.emptyTitle}>{t('This folder is empty')}</h3>
                <p className={styles.emptyText}>
                  {t("Select multiple items from the main Library page, and choose 'Move to Folder' to place files here.")}
                </p>
              </div>
            ) : (
              <div className={showSuccessPulse ? styles.successPulse : ''}>
                <div className={tableStyles.tableContainer}>
                  <table className={tableStyles.screensTable}>
                    <thead className={tableStyles.tableHeader}>
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
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </th>
                        <th style={{ width: '35%' }}>{t('File Name')}</th>
                        <th style={{ width: '15%' }}>{t('Type')}</th>
                        <th style={{ width: '15%' }}>{t('Size')}</th>
                        <th style={{ width: '25%' }}>{t('Date Added')}</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map((asset) => {
                        const isMenuOpen = openMenuId === asset.id
                        const date = new Date(asset.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })

                        return (
                          <tr key={asset.id} className={`${tableStyles.tableRow} ${selectedAssetIds.has(asset.id) ? tableStyles.rowSelected : ''}`}>
                            <td 
                              className={tableStyles.tableCell} 
                              style={{ width: '40px', textAlign: 'center', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleSelect(asset.id)
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={selectedAssetIds.has(asset.id)} 
                                onChange={(e) => {}} 
                                style={{ width: '16px', height: '16px', cursor: 'pointer', pointerEvents: 'none' }}
                              />
                            </td>
                            <td
                              className={tableStyles.tableCell}
                              onClick={() => setPreviewAsset(asset)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={tableStyles.nameCellContent}>
                                <div className={tableStyles.deviceIconWrapper}>
                                  {isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode' ? (
                                    getPreviewUrl(asset.file_path) ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={getPreviewUrl(asset.file_path)!} className={tableStyles.tableThumbnail} alt="" />
                                    ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                                      <QrCode size={20} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                                    ) : (
                                      <ImageIcon size={20} />
                                    )
                                  ) : isVideo(asset.mime_type) ? (
                                    getPreviewUrl(asset.file_path) ? (
                                      <video src={getPreviewUrl(asset.file_path)! + '#t=0.001'} className={tableStyles.tableThumbnail} preload="metadata" muted playsInline />
                                    ) : (
                                      <Play size={20} />
                                    )
                                  ) : asset.mime_type === 'application/x-widget-youtube' ? (
                                    <YoutubeIcon size={20} style={{ stroke: '#ff0000', color: '#ff0000' }} />
                                  ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                                    <LinkIcon size={20} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
                                  ) : asset.mime_type === 'application/x-widget-html' ? (
                                    <Code size={20} style={{ stroke: '#10b981', color: '#10b981' }} />
                                  ) : asset.mime_type === 'application/x-widget-flow' ? (
                                    <Clock size={20} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
                                  ) : asset.mime_type === 'application/x-widget-countdown' ? (
                                    <Hourglass size={20} style={{ stroke: '#eab308', color: '#eab308' }} />
                                  ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                                    <QrCode size={20} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                                  ) : (
                                    <File size={20} />
                                  )}
                                </div>
                                <div className={tableStyles.cellName}>{asset.file_name}</div>
                              </div>
                            </td>
                            <td className={tableStyles.tableCell}>
                              <div 
                                className={tableStyles.contentIconWrap}
                                title={asset.mime_type === 'application/x-widget-flow' ? 'CLOCK' : asset.mime_type === 'application/x-widget-countdown' ? 'COUNTDOWN' : isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
                                style={{ cursor: 'help' }}
                              >
                                {isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode' ? (
                                  asset.mime_type === 'application/x-widget-qrcode' ? (
                                    <QrCode size={15} />
                                  ) : (
                                    <ImageIcon size={15} />
                                  )
                                ) : isVideo(asset.mime_type) ? (
                                  <Play size={15} />
                                ) : asset.mime_type === 'application/x-widget-youtube' ? (
                                  <YoutubeIcon size={15} />
                                ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                                  <LinkIcon size={15} />
                                ) : asset.mime_type === 'application/x-widget-html' ? (
                                  <Code size={15} />
                                ) : asset.mime_type === 'application/x-widget-flow' ? (
                                  <Clock size={15} />
                                ) : asset.mime_type === 'application/x-widget-countdown' ? (
                                  <Hourglass size={15} />
                                ) : (
                                  <File size={15} />
                                )}
                              </div>
                            </td>
                            <td
                              className={tableStyles.tableCell}
                              style={{ fontSize: '0.88rem', color: 'var(--on-surface)' }}
                            >
                              {formatBytes(asset.size_bytes)}
                            </td>
                            <td className={tableStyles.tableCell}>
                              <div className={tableStyles.cellLastSeen}>{date}</div>
                            </td>
                            <td className={tableStyles.tableCell}>
                              <div className={tableStyles.actionsGroup}>
                                <div className={tableStyles.moreMenuWrapper}>
                                  <button
                                    className={`${tableStyles.actionBtnBox} ${
                                      isMenuOpen ? tableStyles.active : ''
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
                                    createPortal(
                                      <div
                                        className={tableStyles.moreDropdown}
                                        style={{
                                          position: 'absolute',
                                          top: menuPosition.top,
                                          right: menuPosition.right,
                                          zIndex: 100000,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          className={tableStyles.dropdownItem}
                                          onClick={() => {
                                            setOpenMenuId(null)
                                            setRenameModalAsset(asset)
                                          }}
                                        >
                                          {t('Rename')}
                                        </button>
                                        {!isWidget(asset.mime_type) && (
                                          <button
                                            className={tableStyles.dropdownItem}
                                            onClick={() => {
                                              setOpenMenuId(null)
                                              handleDownload(asset)
                                            }}
                                          >
                                            {t('Download')}
                                          </button>
                                        )}
                                        <button
                                          className={tableStyles.dropdownItem}
                                          onClick={() => {
                                            setOpenMenuId(null)
                                            handleMoveToRoot(asset.id)
                                          }}
                                        >
                                          {t('Move to Root')}
                                        </button>
                                        <button
                                          className={`${tableStyles.dropdownItem} ${tableStyles.danger}`}
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
              </div>
            )}

            {/* Pagination Footer */}
            {assets.length > 0 && (
              <div className={styles.tableFooter}>
                <div className={styles.paginationInfo}>
                  {searchQuery 
                    ? `${t('Showing')} ${filteredAssets.length} ${t('filtered assets')}` 
                    : `${t('Showing')} ${startItem} ${t('to')} ${endItem} ${t('of')} ${assets.length} ${t('assets')}`
                  }
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className={styles.perPageSelector} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--on-surface-muted)' }}>
                    <span>{t('Per page:')}</span>
                    <select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      style={{
                        padding: '4px 28px 4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--outline-variant)',
                        background: 'var(--surface-low)',
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 7px center',
                        backgroundSize: '12px 12px',
                        minWidth: '56px'
                      }}
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  {!searchQuery && (
                    <div className={styles.pagination}>
                      <span className={styles.pageIndicator}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button 
                        className={styles.pageBtn} 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrevPage}
                        style={{ opacity: hasPrevPage ? 1 : 0.5, cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        className={styles.pageBtn} 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasNextPage}
                        style={{ opacity: hasNextPage ? 1 : 0.5, cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          previewUrl={previewAsset.mime_type === 'application/x-widget-qrcode' ? getPreviewUrl(previewAsset.file_path) : (isWidget(previewAsset.mime_type) ? null : getPreviewUrl(previewAsset.file_path))}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {renameModalAsset && (
        <RenameAssetModal
          currentName={renameModalAsset.file_name}
          teamSlug={teamSlug}
          assetId={renameModalAsset.id}
          mimeType={renameModalAsset.mime_type}
          currentColor={renameModalAsset.color}
          onClose={() => setRenameModalAsset(null)}
          onSuccess={handleRenameAssetSuccess}
        />
      )}

      {deleteModalAsset && (
        <DeleteAssetModal
          assetId={deleteModalAsset.id}
          assetName={deleteModalAsset.file_name}
          filePath={deleteModalAsset.file_path}
          teamSlug={teamSlug}
          onClose={() => setDeleteModalAsset(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}

      {showBulkDeleteModal && (
        <BulkDeleteModal
          assetsToDelete={assets.filter(a => selectedAssetIds.has(a.id))}
          teamSlug={teamSlug}
          onClose={() => setShowBulkDeleteModal(false)}
          onSuccess={() => {
            setAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)))
            setSelectedAssetIds(new Set())
            setShowBulkDeleteModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
