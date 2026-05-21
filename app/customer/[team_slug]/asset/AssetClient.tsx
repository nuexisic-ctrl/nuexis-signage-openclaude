'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, File, Play, Plus, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUploadUrl, insertAsset } from './actions'
import { AssetPreviewModal } from './AssetPreviewModal'
import { UploadZone } from './UploadZone'
import { AssetCard } from './AssetCard'
import { FilterSidebar } from './FilterSidebar'
import { RenameAssetModal, DeleteAssetModal } from './ActionModals'
import { WidgetSelectionModal, YouTubeWidgetModal, RemoteUrlWidgetModal } from './WidgetModals'
import { AssetTableView } from './AssetTableView'
import { Asset, formatBytes, isImage, isVideo, isWidget } from './types'
import styles from './asset.module.css'

interface Props {
  initialAssets: Asset[]
  teamId: string
  teamSlug: string
  totalAssets?: number
  currentPage?: number
  pageSize?: number
}

export default function AssetClient({
  initialAssets,
  teamId,
  teamSlug,
  totalAssets = 0,
  currentPage = 1,
  pageSize = 30
}: Props) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [showWidgetSelection, setShowWidgetSelection] = useState(false)
  const [showYouTubeConfig, setShowYouTubeConfig] = useState(false)
  const [showRemoteUrlConfig, setShowRemoteUrlConfig] = useState(false)
  const [isSubmittingWidget, setIsSubmittingWidget] = useState(false)
  const [renameModalAsset, setRenameModalAsset] = useState<Asset | null>(null)
  const [deleteModalAsset, setDeleteModalAsset] = useState<Asset | null>(null)
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDatePreset, setFilterDatePreset] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem('assetsViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

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

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const generateUrls = async () => {
      const targetAssets = assets.filter(
        asset => (isImage(asset.mime_type) || isVideo(asset.mime_type)) && !asset.mime_type.startsWith('application/x-widget')
      )
      const promises = targetAssets.map(async (asset) => {
        const { data } = await supabase.storage
          .from('workspace-media')
          .createSignedUrl(asset.file_path, 3600)
        return { path: asset.file_path, url: data?.signedUrl || null }
      })
      const results = await Promise.all(promises)
      const urls: Record<string, string> = {}
      for (const res of results) {
        if (res.url) {
          urls[res.path] = res.url
        }
      }
      setPreviewUrls(urls)
    }
    generateUrls()
  }, [assets, supabase])

  const getPreviewUrl = useCallback((filePath: string) => {
    return previewUrls[filePath] || null
  }, [previewUrls])

  const handleFiles = useCallback(async (files: File[]) => {
    if (!teamId) {
      setUploadError('Could not determine your team. Please refresh and try again.')
      return
    }
    setUploadError(null)
    setIsUploading(true)
    setUploadProgress(0)

    const total = files.length
    let completed = 0
    const newAssets: Asset[] = []

    for (const file of files) {
      try {
        const uploadUrlResult = await getUploadUrl(teamSlug, file.name, file.size)
        
        if (!uploadUrlResult.success) {
          setUploadError(`Failed to get upload URL for "${file.name}": ${uploadUrlResult.error}`)
          continue
        }

        const { path: filePath, token } = uploadUrlResult

        const { error: storageError } = await supabase.storage
          .from('workspace-media')
          .uploadToSignedUrl(filePath, token, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (storageError) {
          console.error('[upload] storage error:', storageError)
          setUploadError(`Upload failed for "${file.name}": ${storageError.message}`)
          continue
        }

        const result = await insertAsset(teamSlug, {
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
        })

        if (!result.success) {
          setUploadError(`Saved file but failed to record metadata: ${result.error}`)
        } else {
          const newAsset: Asset = {
            id: result.id,
            file_name: file.name,
            file_path: filePath,
            mime_type: file.type,
            size_bytes: file.size,
            created_at: new Date().toISOString(),
          }
          newAssets.push(newAsset)
        }
      } catch (err) {
        console.error('[upload] unexpected error:', err)
        setUploadError(`Unexpected error uploading "${file.name}".`)
      }

      completed += 1
      setUploadProgress(Math.round((completed / total) * 100))
    }

    setAssets(prev => [...newAssets.reverse(), ...prev])
    setIsUploading(false)
    setUploadProgress(0)

    if (newAssets.length > 0) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    }

    startTransition(() => {
      router.refresh()
    })
  }, [teamId, teamSlug, supabase, router])

  const handleCreateYouTubeWidget = async (name: string, url: string) => {
    setIsSubmittingWidget(true)
    setUploadError(null)

    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: url,
      mime_type: 'application/x-widget-youtube',
      size_bytes: 0,
    })

    if (!result.success) {
      setUploadError(`Failed to save widget: ${result.error}`)
    } else {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: url,
        mime_type: 'application/x-widget-youtube',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowYouTubeConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => {
        router.refresh()
      })
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateRemoteUrlWidget = async (name: string, url: string) => {
    setIsSubmittingWidget(true)
    setUploadError(null)

    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: url,
      mime_type: 'application/x-widget-remote-url',
      size_bytes: 0,
    })

    if (!result.success) {
      setUploadError(`Failed to save widget: ${result.error}`)
    } else {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: url,
        mime_type: 'application/x-widget-remote-url',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowRemoteUrlConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => {
        router.refresh()
      })
    }
    setIsSubmittingWidget(false)
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

  const filteredAssets = assets.filter(a => {
    if (filterType !== 'all') {
      if (filterType === 'image' && !isImage(a.mime_type)) return false
      if (filterType === 'video' && !isVideo(a.mime_type)) return false
      if (filterType === 'widget' && !isWidget(a.mime_type)) return false
    }

    if (filterDatePreset !== 'all') {
      const now = new Date()
      const dDate = new Date(a.created_at).getTime()
      
      if (filterDatePreset === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        if (dDate < startOfToday) return false
      } else if (filterDatePreset === '7days') {
        const startOf7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime()
        if (dDate < startOf7DaysAgo) return false
      } else if (filterDatePreset === '30days') {
        const startOf30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime()
        if (dDate < startOf30DaysAgo) return false
      } else if (filterDatePreset === 'custom') {
        if (filterStartDate) {
          const start = new Date(filterStartDate).getTime()
          if (dDate < start) return false
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate)
          end.setDate(end.getDate() + 1)
          if (dDate >= end.getTime()) return false
        }
      }
    }

    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return a.file_name.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(totalAssets / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = totalAssets === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalAssets)

  return (
    <div className={styles.assetArea}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Media Library</h2>
        <button 
          onClick={() => setShowWidgetSelection(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
            background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: '8px', 
            border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)' 
          }}
        >
          <Plus size={16} />
          Create Widget
        </button>
      </div>

      <UploadZone
        onFiles={handleFiles}
        isUploading={isUploading}
        progress={uploadProgress}
        onError={setUploadError}
      />

      {uploadError && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle className={styles.errorIcon} size={17} />
          {uploadError}
        </div>
      )}

      {showSuccess && (
        <div className={styles.successBanner} role="alert">
          <Check className={styles.successIcon} size={17} />
          Media successfully uploaded. Ready to be assigned in the Screens page!
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
                  placeholder="Search by file name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className={styles.controlsRight}>
                <button 
                  className={`${styles.filterBtn} ${isFilterSidebarOpen || filterType !== 'all' || filterDatePreset !== 'all' ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  Filters
                  {(filterType !== 'all' || filterDatePreset !== 'all') && (
                    <span className={styles.filterDot} />
                  )}
                </button>
                {isMounted && (
                  <div className={styles.viewToggleGroup}>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('grid')}
                      title="Grid View"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="14" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="3" y="14" width="7" height="7" rx="1" ry="1"></rect>
                      </svg>
                    </button>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('table')}
                      title="Table View"
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
                  </div>
                )}
              </div>
            </div>

            {!isMounted ? (
              <div className={styles.grid} style={{ opacity: 0 }}>
                <div style={{ height: '300px' }} />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><File size={28} /></div>
                <h3 className={styles.emptyTitle}>No assets found</h3>
                <p className={styles.emptyText}>
                  {assets.length === 0 
                    ? "Upload images or videos above to start building your asset library."
                    : "No assets matched your search criteria."
                  }
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={styles.grid}>
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    previewUrl={isImage(asset.mime_type) || isVideo(asset.mime_type) ? getPreviewUrl(asset.file_path) : null}
                    onDelete={() => {
                      setOpenMenuId(null)
                      setDeleteModalAsset(asset)
                    }}
                    onPreview={setPreviewAsset}
                    onRename={() => {
                      setOpenMenuId(null)
                      setRenameModalAsset(asset)
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
                  />
                ))}
              </div>
            ) : (
              <AssetTableView
                filteredAssets={filteredAssets}
                openMenuId={openMenuId}
                menuPosition={menuPosition}
                setOpenMenuId={setOpenMenuId}
                setMenuPosition={setMenuPosition}
                setPreviewAsset={setPreviewAsset}
                setRenameModalAsset={setRenameModalAsset}
                setDeleteModalAsset={setDeleteModalAsset}
                deletingIds={deletingIds}
              />
            )}
            
            {assets.length > 0 && (
              <div className={styles.tableFooter}>
                <div>
                  {searchQuery 
                    ? `Showing ${filteredAssets.length} filtered assets` 
                    : `Showing ${startItem} to ${endItem} of ${totalAssets} assets`
                  }
                </div>
                {!searchQuery && (
                  <div className={styles.pagination}>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage - 1}`)}
                      disabled={!hasPrevPage}
                      style={{ opacity: hasPrevPage ? 1 : 0.5, cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    </button>
                    <button className={`${styles.pageBtn} ${styles.active}`}>{currentPage}</button>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage + 1}`)}
                      disabled={!hasNextPage}
                      style={{ opacity: hasNextPage ? 1 : 0.5, cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isFilterSidebarOpen && (
          <FilterSidebar
            filterType={filterType}
            setFilterType={setFilterType}
            filterDatePreset={filterDatePreset}
            setFilterDatePreset={setFilterDatePreset}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            onClose={() => setIsFilterSidebarOpen(false)}
          />
        )}
      </div>

      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          previewUrl={isWidget(previewAsset.mime_type) ? null : getPreviewUrl(previewAsset.file_path)}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {showWidgetSelection && (
        <WidgetSelectionModal 
          onClose={() => setShowWidgetSelection(false)} 
          onSelectYouTube={() => setShowYouTubeConfig(true)}
          onSelectRemoteUrl={() => setShowRemoteUrlConfig(true)}
        />
      )}

      {showYouTubeConfig && (
        <YouTubeWidgetModal 
          onClose={() => setShowYouTubeConfig(false)}
          onSubmit={handleCreateYouTubeWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showRemoteUrlConfig && (
        <RemoteUrlWidgetModal 
          onClose={() => setShowRemoteUrlConfig(false)}
          onSubmit={handleCreateRemoteUrlWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {renameModalAsset && (
        <RenameAssetModal
          currentName={renameModalAsset.file_name}
          teamSlug={teamSlug}
          assetId={renameModalAsset.id}
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
    </div>
  )
}
