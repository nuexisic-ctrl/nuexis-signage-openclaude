'use client'

import { useState, useRef, useEffect, useCallback, useMemo, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Check, File, Plus, RefreshCw, Upload, ChevronLeft, ChevronRight, Trash2, FolderPlus, FolderInput, Folder } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import { AssetPreviewModal } from './AssetPreviewModal'
import { AssetCard } from './AssetCard'
import { FilterSidebar } from './FilterSidebar'
import { RenameAssetModal, DeleteAssetModal } from './ActionModals'
import { AssetTableView } from './AssetTableView'
import { Asset, ScreenDevice, isImage, isVideo, isWidget } from './types'
import { BulkDeleteModal } from './BulkDeleteModal'
import { useAssetUpload } from './useAssetUpload'
import { UploadPanel } from './UploadPanel'
import { WidgetModalsContainer } from './WidgetModalsContainer'
import { CreateFolderModal } from './CreateFolderModal'
import { BulkMoveModal } from './BulkMoveModal'
import { PushToScreenModal } from './PushToScreenModal'
import { t } from '@/lib/i18n'
import styles from './asset.module.css'

interface Props {
  initialAssets: Asset[]
  screens: ScreenDevice[]
  teamId: string
  teamSlug: string
  totalAssets?: number
  currentPage?: number
  pageSize?: number
  folder?: Asset
}

export default function AssetClient({
  initialAssets,
  screens,
  teamId,
  teamSlug,
  totalAssets = 0,
  currentPage: initialCurrentPage = 1,
  pageSize: initialPageSize = 10,
  folder,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [showWidgetSelection, setShowWidgetSelection] = useState(false)
  const [renameModalAsset, setRenameModalAsset] = useState<Asset | null>(null)
  const [deleteModalAsset, setDeleteModalAsset] = useState<Asset | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false)
  const [pushModalAsset, setPushModalAsset] = useState<Asset | null>(null)

  const handleToggleSelect = useCallback((assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }, [])
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false)
  
  // Advanced filters state variables
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDatePreset, setFilterDatePreset] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [filterSizePreset, setFilterSizePreset] = useState<string>('all')
  const [filterMinSize, setFilterMinSize] = useState<string>('')
  const [filterMaxSize, setFilterMaxSize] = useState<string>('')

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [showSuccessPulse, setShowSuccessPulse] = useState(false)

  const [currentPage, setCurrentPage] = useState(initialCurrentPage)
  const [pageSize, setPageSize] = useState<number>(initialPageSize)

  const [, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const savedLimit = localStorage.getItem('nuexis_assets_per_page')
    if (savedLimit) {
      setPageSize(Number(savedLimit) || 10)
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType, filterDatePreset, filterSizePreset])

  // Use the extracted asset upload custom hook
  const {
    uploadQueue,
    setUploadQueue,
    isQueueCollapsed,
    setIsQueueCollapsed,
    showQueuePanel,
    setShowQueuePanel,
    uploadError,
    showSuccess,
    setShowSuccess,
    handleFiles,
  } = useAssetUpload({
    teamId,
    teamSlug,
    supabase,
    setAssets,
    startTransition,
    router,
    folderId: folder?.id,
  })

  useEffect(() => {
    const saved = localStorage.getItem('assetsViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setAssets(initialAssets)
  }, [initialAssets])

  useEffect(() => {
    const handleClick = () => {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('assetsViewMode', mode)
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, supabase])

  const getPreviewUrl = useCallback((filePath: string) => {
    return previewUrls.get(filePath) || null
  }, [previewUrls])

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      startTransition(() => {
        router.refresh()
      })
      await new Promise(resolve => setTimeout(resolve, 600))
      setShowSuccessPulse(true)
      setTimeout(() => setShowSuccessPulse(false), 600)
    } catch (err) {
      console.error('[Assets] Error during refresh:', err)
    } finally {
      setIsRefreshing(false)
    }
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

  const handleRenameAssetSuccess = (newName: string, newColor?: string) => {
    setAssets(prev => prev.map(a => 
      a.id === renameModalAsset?.id 
        ? { ...a, file_name: newName, ...(newColor ? { color: newColor } : {}) } 
        : a
    ))
    setRenameModalAsset(null)
  }

  const handlePreviewAsset = (asset: Asset) => {
    if (asset.mime_type === 'application/x-folder') {
      router.push(`/customer/${teamSlug}/asset/folder/${asset.id}`)
    } else {
      setPreviewAsset(asset)
    }
  }

  useEffect(() => {
    const folderList = assets.filter(a => a.mime_type === 'application/x-folder')
    const cachedFolders: Record<string, { name: string; color: string }> = {}
    folderList.forEach(f => {
      cachedFolders[f.id] = { name: f.file_name, color: f.color || '#78716c' }
    })
    localStorage.setItem('nuexis_folders_cache', JSON.stringify(cachedFolders))
  }, [assets])

  const filteredAssets = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const today = new Date().setHours(0,0,0,0)
    
    const filtered = assets.filter(a => {
      if (filterType !== 'all') {
        if (filterType === 'image' && !isImage(a.mime_type)) return false
        if (filterType === 'video' && !isVideo(a.mime_type)) return false
        if (filterType === 'widget' && !isWidget(a.mime_type)) return false
      }

      if (filterDatePreset !== 'all') {
        const dDate = new Date(a.created_at).getTime()
        if (filterDatePreset === 'today' && dDate < today) return false
        if (filterDatePreset === '7days' && dDate < now - 7 * 86400000) return false
        if (filterDatePreset === '30days' && dDate < now - 30 * 86400000) return false
        if (filterDatePreset === 'custom') {
          if (filterStartDate && dDate < new Date(filterStartDate).getTime()) return false
          if (filterEndDate && dDate >= new Date(filterEndDate).getTime() + 86400000) return false
        }
      }

      // Storage Size Filtering (size is computed in decimal MB)
      if (filterSizePreset !== 'all') {
        const sizeMB = (a.size_bytes || 0) / (1024 * 1024)
        if (filterSizePreset === 'under1' && sizeMB >= 1) return false
        if (filterSizePreset === '1to10' && (sizeMB < 1 || sizeMB > 10)) return false
        if (filterSizePreset === '10to50' && (sizeMB < 10 || sizeMB > 50)) return false
        if (filterSizePreset === 'custom') {
          if (filterMinSize) {
            const min = parseFloat(filterMinSize)
            if (!isNaN(min) && sizeMB < min) return false
          }
          if (filterMaxSize) {
            const max = parseFloat(filterMaxSize)
            if (!isNaN(max) && sizeMB > max) return false
          }
        }
      }

      if (searchQuery) {
        const matchesSearch = a.file_name.toLowerCase().includes(searchQuery.toLowerCase())
        if (folder) {
          return matchesSearch && a.folder_id === folder.id
        }
        return matchesSearch
      }
      
      // Root level assets (or folders) when no search is active, or assets within the active folder
      return folder ? a.folder_id === folder.id : !a.folder_id
    })

    // Sort folders at the top, then by created_at descending
    return filtered.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/x-folder'
      const bIsFolder = b.mime_type === 'application/x-folder'
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [assets, filterType, filterDatePreset, filterStartDate, filterEndDate, filterSizePreset, filterMinSize, filterMaxSize, searchQuery, folder])

  const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = filteredAssets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredAssets.length)

  // Navigate to a new page — update local state and localStorage
  const navigatePage = (page: number, limit: number) => {
    setPageSize(limit)
    setCurrentPage(page)
    localStorage.setItem('nuexis_assets_per_page', String(limit))
  }

  const paginatedAssets = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return filteredAssets.slice(from, from + pageSize)
  }, [filteredAssets, currentPage, pageSize])

  const isFiltersActive = isFilterSidebarOpen || filterType !== 'all' || filterDatePreset !== 'all' || filterSizePreset !== 'all'
  const showFilterDot = filterType !== 'all' || filterDatePreset !== 'all' || filterSizePreset !== 'all'

  return (
    <div className={styles.assetArea}>
      <div className={`${styles.topbar} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div>
          {folder ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.94rem', color: 'var(--on-surface-subtle)', fontWeight: 600 }}>
                <Link href={`/customer/${teamSlug}/asset`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  {t('All items')}
                </Link>
                <span style={{ opacity: 0.5 }}>/</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--on-surface)' }}>
                  <Folder size={16} style={{ stroke: folder.color || '#78716c', fill: folder.color || '#78716c', fillOpacity: 0.15 }} />
                  {folder.file_name}
                </span>
              </div>
              <h1 className={styles.pageTitle} style={{ marginTop: '6px' }}>{folder.file_name}</h1>
            </div>
          ) : (
            <>
              <h1 className={styles.pageTitle}>{t('Asset Library')}</h1>
              <p className={styles.pageSubtitle}>
                {totalAssets > 0
                  ? `${totalAssets} ${totalAssets === 1 ? t('asset') : t('assets')} ${t('in your library.')}`
                  : t('Upload images and videos to get started.')}
              </p>
            </>
          )}
        </div>
        <div className={styles.topbarActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Status"
            title="Refresh Status"
          >
            <RefreshCw size={20} className={isRefreshing ? styles.spin : ''} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/webm,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) handleFiles(files)
              e.target.value = ''
            }}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
              background: 'var(--surface-low)', color: 'var(--on-surface)', borderRadius: '8px', 
              border: '1px solid var(--outline-variant)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)',
              minHeight: '42px'
            }}
          >
            <Upload size={16} />
            {t('Upload Media')}
          </button>
          <button 
            onClick={() => setShowCreateFolder(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
              background: 'var(--surface-low)', color: 'var(--on-surface)', borderRadius: '8px', 
              border: '1px solid var(--outline-variant)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)',
              minHeight: '42px'
            }}
          >
            <FolderPlus size={16} />
            {t('New Folder')}
          </button>
          <button 
            onClick={() => setShowWidgetSelection(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
              background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: '8px', 
              border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)',
              minHeight: '42px'
            }}
          >
            <Plus size={16} />
            {t('Create Widget')}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle className={styles.errorIcon} size={17} />
          {uploadError}
        </div>
      )}

      {showSuccess && (
        <div className={styles.successBanner} role="alert">
          <Check className={styles.successIcon} size={17} />
          {t('Media uploaded successfully')}
        </div>
      )}

      <div className={styles.pageLayout}>
        <div className={`${styles.mainContent} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.mainBlockContainer}>
            <div className={styles.controlsBar}>
              <div className={styles.searchBox}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  className={styles.searchInput}
                  placeholder={t('Search by file name...')}
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
                      onClick={() => setShowBulkMoveModal(true)}
                      title={t('Move to Folder')}
                    >
                      <FolderInput size={16} />
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
                <button 
                  className={`${styles.filterBtn} ${isFiltersActive ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  {t('Filters')}
                  {showFilterDot && <span className={styles.filterDot} />}
                </button>
                {isMounted && (
                  <div className={styles.viewToggleGroup}>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('table')}
                      title={t('Table View')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </button>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('grid')}
                      title={t('Grid View')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="14" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="3" y="14" width="7" height="7" rx="1" ry="1"></rect>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`${styles.progressBarWrapper} ${isRefreshing ? styles.active : ''}`}>
              <div className={styles.progressBarLine} />
            </div>

            {filteredAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><File size={28} /></div>
                <h3 className={styles.emptyTitle}>{t('No assets found')}</h3>
                <p className={styles.emptyText}>
                  {assets.length === 0 
                    ? t("Upload images or videos above to start building your asset library.")
                    : t("No assets matched your search criteria.")
                  }
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
                {paginatedAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    previewUrl={(isImage(asset.mime_type) || isVideo(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode') ? getPreviewUrl(asset.file_path) : null}
                    onDelete={() => {
                      setOpenMenuId(null)
                      setDeleteModalAsset(asset)
                    }}
                    onPreview={handlePreviewAsset}
                    onRename={() => {
                      setOpenMenuId(null)
                      setRenameModalAsset(asset)
                    }}
                    onPushToScreen={() => {
                      setOpenMenuId(null)
                      setPushModalAsset(asset)
                    }}
                    isDeleting={deletingIds.has(asset.id)}
                    menuOpen={openMenuId === asset.id}
                    menuPosition={menuPosition}
                    onToggleMenu={(e) => {
                      e.stopPropagation()
                      if (openMenuId === asset.id) {
                        setOpenMenuId(null)
                        setMenuPosition(null)
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuPosition({ top: rect.bottom + window.scrollY + 6, right: window.innerWidth - rect.right })
                        setOpenMenuId(asset.id)
                      }
                    }}
                    selected={selectedAssetIds.has(asset.id)}
                    onToggleSelect={() => handleToggleSelect(asset.id)}
                  />
                ))}
              </div>
            ) : (
              <div className={showSuccessPulse ? styles.successPulse : ''}>
                <AssetTableView
                  filteredAssets={paginatedAssets}
                  openMenuId={openMenuId}
                  menuPosition={menuPosition}
                  setOpenMenuId={setOpenMenuId}
                  setMenuPosition={setMenuPosition}
                  setPreviewAsset={handlePreviewAsset}
                  setRenameModalAsset={setRenameModalAsset}
                  setDeleteModalAsset={setDeleteModalAsset}
                  setPushModalAsset={setPushModalAsset}
                  deletingIds={deletingIds}
                  getPreviewUrl={getPreviewUrl}
                  selectedAssetIds={selectedAssetIds}
                  setSelectedAssetIds={setSelectedAssetIds}
                  handleToggleSelect={handleToggleSelect}
                />
              </div>
            )}
            
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
                        const val = e.target.value
                        navigatePage(1, Number(val))
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
                        onClick={() => navigatePage(currentPage - 1, pageSize)}
                        disabled={!hasPrevPage}
                        style={{ opacity: hasPrevPage ? 1 : 0.5, cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        className={styles.pageBtn} 
                        onClick={() => navigatePage(currentPage + 1, pageSize)}
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

        <FilterSidebar
          isOpen={isFilterSidebarOpen}
          filterType={filterType}
          setFilterType={setFilterType}
          filterDatePreset={filterDatePreset}
          setFilterDatePreset={setFilterDatePreset}
          filterStartDate={filterStartDate}
          setFilterStartDate={setFilterStartDate}
          filterEndDate={filterEndDate}
          setFilterEndDate={setFilterEndDate}
          filterSizePreset={filterSizePreset}
          setFilterSizePreset={setFilterSizePreset}
          filterMinSize={filterMinSize}
          setFilterMinSize={setFilterMinSize}
          filterMaxSize={filterMaxSize}
          setFilterMaxSize={setFilterMaxSize}
          onClose={() => setIsFilterSidebarOpen(false)}
        />
      </div>

      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          previewUrl={previewAsset.mime_type === 'application/x-widget-qrcode' ? getPreviewUrl(previewAsset.file_path) : (isWidget(previewAsset.mime_type) ? null : getPreviewUrl(previewAsset.file_path))}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      <WidgetModalsContainer
        showWidgetSelection={showWidgetSelection}
        setShowWidgetSelection={setShowWidgetSelection}
        teamSlug={teamSlug}
        assets={assets}
        setAssets={setAssets}
        setShowSuccess={setShowSuccess}
        folderId={folder?.id}
      />

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

      {showCreateFolder && (
        <CreateFolderModal
          teamSlug={teamSlug}
          onClose={() => setShowCreateFolder(false)}
          onSuccess={(id) => {
            setShowCreateFolder(false)
            router.refresh()
          }}
          parentFolderId={folder?.id}
        />
      )}

      {showBulkMoveModal && (
        <BulkMoveModal
          selectedAssets={assets.filter(a => selectedAssetIds.has(a.id))}
          folders={assets.filter(a => a.mime_type === 'application/x-folder' && (!folder || a.id !== folder.id))}
          teamSlug={teamSlug}
          onClose={() => setShowBulkMoveModal(false)}
          onSuccess={() => {
            setSelectedAssetIds(new Set())
            setShowBulkMoveModal(false)
            router.refresh()
          }}
        />
      )}

      {pushModalAsset && (
        <PushToScreenModal
          asset={pushModalAsset}
          screens={screens}
          teamSlug={teamSlug}
          onClose={() => setPushModalAsset(null)}
          onSuccess={() => {
            setPushModalAsset(null)
            router.refresh()
          }}
        />
      )}

      {/* Floating Upload Manager Panel */}
      <UploadPanel
        showQueuePanel={showQueuePanel}
        uploadQueue={uploadQueue}
        isQueueCollapsed={isQueueCollapsed}
        setIsQueueCollapsed={setIsQueueCollapsed}
        setShowQueuePanel={setShowQueuePanel}
        setUploadQueue={setUploadQueue}
      />
    </div>
  )
}
