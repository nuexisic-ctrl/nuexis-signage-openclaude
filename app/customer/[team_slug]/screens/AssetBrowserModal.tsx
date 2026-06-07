'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, FileText, Video, Image as ImageIcon, Play, MoreVertical, Plus, FolderPlus, Upload, Folder, ChevronDown } from 'lucide-react'
import styles from './AssetBrowserModal.module.css'
import { FilterSidebar } from '../asset/FilterSidebar'
import { modalStack } from '@/lib/utils/modalStack'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { createClient } from '@/lib/supabase/client'
import { Asset } from './types'
import { useAssetUpload } from '../asset/useAssetUpload'
import { UploadPanel } from '../asset/UploadPanel'
import { WidgetModalsContainer } from '../asset/WidgetModalsContainer'
import { CreateFolderModal } from '../asset/CreateFolderModal'
import { fetchFolderFiles } from '../asset/actions'
import { toast } from '@/app/components/Toast'
import { formatDate, formatSize, getAssetTypeBadge, CardPreview, TableIcon, useFilteredAssets, getBreadcrumbs, useAssetPreviewUrls, useDragAndDrop } from './AssetBrowserPreview'

export interface AssetBrowserModalProps {
  assets: Asset[]
  teamSlug?: string
  teamId?: string
  onClose: () => void
  onSelect: (assetId: string) => void
}

export function AssetBrowserModal({
  assets,
  teamSlug,
  teamId,
  onClose,
  onSelect,
}: AssetBrowserModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])

  // Folder navigation and caching states
  const [folders, setFolders] = useState<Asset[]>(() => assets.filter(a => a.mime_type === 'application/x-folder'))
  const [filesCache, setFilesCache] = useState<Record<string, Asset[]>>(() => {
    const rootFiles = assets.filter(a => a.mime_type !== 'application/x-folder' && !a.folder_id)
    return { root: rootFiles }
  })
  const [activeFolder, setActiveFolder] = useState<Asset | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Creation & Upload sub-modal states
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [showWidgetSelection, setShowWidgetSelection] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Synchronize initial folder list when assets prop updates
  useEffect(() => {
    setFolders(assets.filter(a => a.mime_type === 'application/x-folder'))
  }, [assets])

  // Close Create dropdown on clicking outside
  useEffect(() => {
    if (!showCreateDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCreateDropdown])

  // SWR Folder contents fetcher
  const loadFolderFiles = useCallback(async (folderId: string | null) => {
    if (!teamSlug) return
    const cacheKey = folderId || 'root'
    const hasCache = !!filesCache[cacheKey]
    if (!hasCache) {
      setIsLoadingFiles(true)
    }

    try {
      const result = await fetchFolderFiles(teamSlug, folderId)
      if (result.success && result.files) {
        setFilesCache(prev => ({
          ...prev,
          [cacheKey]: result.files as Asset[]
        }))
      } else {
        toast.error(result.error || 'Failed to refresh folder contents.')
      }
    } catch (err) {
      console.error('[loadFolderFiles] error:', err)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [teamSlug, filesCache])

  useEffect(() => {
    loadFolderFiles(activeFolder?.id || null)
  }, [activeFolder])

  // Local state setAssets handler
  const handleSetAssets = useCallback((updater: Asset[] | ((prev: Asset[]) => Asset[])) => {
    const activeId = activeFolder?.id || 'root'
    const currentFilesList = filesCache[activeId] || []
    const nextFilesList = typeof updater === 'function' ? updater(currentFilesList) : updater
    
    setFilesCache(prev => ({
      ...prev,
      [activeId]: nextFilesList.filter(a => a.mime_type !== 'application/x-folder')
    }))
  }, [activeFolder, filesCache])

  // Upload hooks & config
  const {
    uploadQueue,
    setUploadQueue,
    isQueueCollapsed,
    setIsQueueCollapsed,
    showQueuePanel,
    setShowQueuePanel,
    handleFiles,
  } = useAssetUpload({
    teamId: teamId || '',
    teamSlug: teamSlug || '',
    supabase,
    setAssets: handleSetAssets,
    startTransition,
    router,
    folderId: activeFolder?.id || null,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag & Drop
  // Drag & Drop
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragAndDrop(handleFiles)

  // Folder creation callback
  const handleCreateFolderSuccess = (id: string, name: string, color: string) => {
    const newFolder: Asset = {
      id,
      file_name: name,
      file_path: 'folder',
      mime_type: 'application/x-folder',
      size_bytes: 0,
      created_at: new Date().toISOString(),
      folder_id: activeFolder?.id || null,
      color,
    }
    setFolders(prev => [newFolder, ...prev])
    setShowCreateFolder(false)
    toast.success(`Folder "${name}" created successfully`)
  }

  // Breadcrumbs helper
  const breadcrumbs = useMemo(() => getBreadcrumbs(activeFolder, folders), [activeFolder, folders])

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('assetBrowserViewMode')
      if (saved === 'grid' || saved === 'table') return saved
    }
    return 'table'
  })
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 10

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('assetBrowserViewMode', mode)
  }

  // Lock body scroll, register with modalStack, Escape key handler
  useEffect(() => {
    modalStack.push('asset-browser-modal')
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalStack.isTop('asset-browser-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      modalStack.pop('asset-browser-modal')
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const allLoadedAssets = useMemo(() => {
    return [...folders, ...Object.values(filesCache).flat()]
  }, [folders, filesCache])

  // Generate signed URLs in real-time
  const previewUrls = useAssetPreviewUrls(allLoadedAssets, supabase)

  const {
    searchQuery, setSearchQuery,
    selectedType, setSelectedType,
    filterDatePreset, setFilterDatePreset,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    filterSizePreset, setFilterSizePreset,
    filterMinSize, setFilterMinSize,
    filterMaxSize, setFilterMaxSize,
    currentPage, setCurrentPage,
    isFilterActive,
    filteredAssets
  } = useFilteredAssets(allLoadedAssets, activeFolder)

  // Pagination Logic
  const totalItems = filteredAssets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const paginatedAssets = useMemo(() => {
    const fromIndex = (currentPage - 1) * pageSize
    return filteredAssets.slice(fromIndex, fromIndex + pageSize)
  }, [filteredAssets, currentPage])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleAssetClick = (asset: Asset) => {
    if (asset.mime_type === 'application/x-folder') {
      setActiveFolder(asset)
      setCurrentPage(1)
    } else {
      onSelect(asset.id)
    }
  }


  return (
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Asset Library</h3>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close browser">
              <X size={16} />
            </button>
          </div>
          
          <div className={styles.controlsRow}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by file name..."
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
              />
            </div>
            
            <div className={styles.actionsRight}>
              {/* Create Dropdown Button */}
              {teamSlug && teamId && (
                <div className={styles.dropdownContainer} ref={dropdownRef}>
                  <button
                    type="button"
                    className={styles.createBtn}
                    onClick={() => setShowCreateDropdown(v => !v)}
                  >
                    Create
                    <ChevronDown size={14} />
                  </button>
                  {showCreateDropdown && (
                    <div className={styles.createDropdown}>
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setShowCreateDropdown(false)
                          fileInputRef.current?.click()
                        }}
                      >
                        <Upload size={14} />
                        Upload
                      </button>
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setShowCreateDropdown(false)
                          setShowWidgetSelection(true)
                        }}
                      >
                        <LayoutGrid size={14} />
                        Apps
                      </button>
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setShowCreateDropdown(false)
                          setShowCreateFolder(true)
                        }}
                      >
                        <FolderPlus size={14} />
                        New Folder
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                className={`${styles.filterToggleBtn} ${showFilters || isFilterActive ? styles.active : ''}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Filter size={14} />
                Filters
                {isFilterActive && <span className={styles.filterDot} />}
              </button>

              <div className={styles.viewToggleGroup}>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('table')}
                  title="Table View"
                >
                  <List size={16} />
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div 
          className={`${styles.body} ${showFilters ? styles.bodyWithSidebar : ''} ${isDragging ? styles.dragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.bodyMain}>
            {/* Breadcrumb Navigation */}
            <div className={styles.breadcrumbContainer}>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {idx > 0 && <span className={styles.breadcrumbSeparator}>&gt;</span>}
                    {isLast ? (
                      <span className={styles.breadcrumbActive}>
                        {crumb.folder && (
                          <Folder size={14} style={{ stroke: crumb.folder.color || '#78716c', fill: crumb.folder.color || '#78716c', fillOpacity: 0.15 }} />
                        )}
                        {crumb.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.breadcrumbLink}
                        onClick={() => {
                          setActiveFolder(crumb.folder)
                          setCurrentPage(1)
                        }}
                      >
                        {crumb.folder && (
                          <Folder size={14} style={{ stroke: crumb.folder.color || '#78716c', fill: crumb.folder.color || '#78716c', fillOpacity: 0.15 }} />
                        )}
                        {crumb.name}
                      </button>
                    )}
                  </span>
                )
              })}
              {isLoadingFiles && (
                <span style={{ marginLeft: '12px', fontSize: '0.78rem', color: 'var(--on-surface-subtle)' }}>
                  Loading...
                </span>
              )}
            </div>

            {paginatedAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <h4 className={styles.emptyText}>No assets match your query.</h4>
              </div>
            ) : viewMode === 'table' ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>File Name</th>
                      <th style={{ width: '15%' }}>Type</th>
                      <th style={{ width: '15%' }}>Size</th>
                      <th style={{ width: '25%' }}>Date Added</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssets.map((asset) => {
                      const badgeType = getAssetTypeBadge(asset.mime_type, asset.file_name)
                      return (
                        <tr
                          key={asset.id}
                          className={styles.row}
                          onClick={() => handleAssetClick(asset)}
                        >
                          <td>
                            <div className={styles.fileNameCell}>
                              <div className={styles.fileIconWrapper}>
                                <TableIcon asset={asset} previewUrls={previewUrls} />
                              </div>
                              <span className={styles.fileNameText}>
                                <FilenameTruncator filename={asset.file_name} />
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.typeBadge}>
                              {badgeType}
                            </span>
                          </td>
                          <td>{asset.mime_type === 'application/x-folder' ? '--' : formatSize(asset.size_bytes)}</td>
                          <td>{formatDate(asset.created_at)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              className={styles.actionIconBtn}
                              onClick={() => handleAssetClick(asset)}
                              title={asset.mime_type === 'application/x-folder' ? "Open Folder" : "Select Asset"}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.grid}>
                {paginatedAssets.map((asset) => {
                  const badgeType = getAssetTypeBadge(asset.mime_type, asset.file_name)
                  return (
                    <div
                      key={asset.id}
                      className={styles.card}
                      onClick={() => handleAssetClick(asset)}
                    >
                      <CardPreview asset={asset} previewUrls={previewUrls} />
                      <div className={styles.cardBody}>
                        <span className={`${styles.typeBadge} ${styles.cardTypeBadge}`}>
                          {badgeType}
                        </span>
                        <h4 className={styles.cardTitle}>
                          <FilenameTruncator filename={asset.file_name} />
                        </h4>
                        <div className={styles.cardDetails}>
                          <span>{asset.mime_type === 'application/x-folder' ? 'Folder' : `${formatSize(asset.size_bytes)} • ${formatDate(asset.created_at)}`}</span>
                        </div>
                        <div className={styles.cardMenuBtn} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.actionIconBtn}
                            onClick={() => handleAssetClick(asset)}
                            title={asset.mime_type === 'application/x-folder' ? "Open Folder" : "Select Asset"}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <FilterSidebar
            isModal={true}
            isOpen={showFilters}
            filterType={selectedType}
            setFilterType={(val) => { setSelectedType(val); setCurrentPage(1) }}
            filterDatePreset={filterDatePreset}
            setFilterDatePreset={(val) => { setFilterDatePreset(val); setCurrentPage(1) }}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            filterSizePreset={filterSizePreset}
            setFilterSizePreset={(val) => { setFilterSizePreset(val); setCurrentPage(1) }}
            filterMinSize={filterMinSize}
            setFilterMinSize={setFilterMinSize}
            filterMaxSize={filterMaxSize}
            setFilterMaxSize={setFilterMaxSize}
            onClose={() => setShowFilters(false)}
          />
        </div>

        <div className={styles.footer}>
          <div>
            Showing {startItem} to {endItem} of {totalItems} assets
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.pageBtn} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Hidden file input for Upload trigger */}
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

      {/* Upload Progress Panel */}
      <UploadPanel
        showQueuePanel={showQueuePanel}
        uploadQueue={uploadQueue}
        isQueueCollapsed={isQueueCollapsed}
        setIsQueueCollapsed={setIsQueueCollapsed}
        setShowQueuePanel={setShowQueuePanel}
        setUploadQueue={setUploadQueue}
      />

      {/* Wrapper to overlay secondary modals (Widget creation & Folder creation) */}
      {teamSlug && teamId && (
        <div className={styles.modalWrapper}>
          <WidgetModalsContainer
            showWidgetSelection={showWidgetSelection}
            setShowWidgetSelection={setShowWidgetSelection}
            teamSlug={teamSlug}
            assets={allLoadedAssets}
            setAssets={handleSetAssets}
            setShowSuccess={() => {}}
            folderId={activeFolder?.id || null}
          />
          {showCreateFolder && (
            <CreateFolderModal
              teamSlug={teamSlug}
              onClose={() => setShowCreateFolder(false)}
              onSuccess={handleCreateFolderSuccess}
              parentFolderId={activeFolder?.id || null}
            />
          )}
        </div>
      )}

    </div>
  )
}
