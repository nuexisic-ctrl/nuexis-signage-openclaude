'use client'

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, Upload, FolderPlus, ChevronDown } from 'lucide-react'
import { useAssetBrowser, AssetBrowserProvider } from './AssetBrowserContext'
import { AssetBrowserBreadcrumbs } from './AssetBrowserBreadcrumbs'
import { AssetBrowserGrid } from './AssetBrowserGrid'
import { AssetBrowserTable } from './AssetBrowserTable'
import { AssetBrowserSidebar } from './AssetBrowserSidebar'
import { AssetBrowserSelection } from './AssetBrowserSelection'
import { modalStack } from '@/lib/utils/modalStack'
import { useAssetUpload } from '../../asset/useAssetUpload'
import { UploadPanel } from '../../asset/UploadPanel'
import { WidgetModalsContainer } from '../../asset/WidgetModalsContainer'
import { CreateFolderModal } from '../../asset/CreateFolderModal'
import { useDragAndDrop } from '../../screens/AssetBrowserPreview'
import { fetchFolderFiles } from '../../asset/actions'
import { toast } from '@/app/components/Toast'
import { Asset } from '../../asset/types'
import styles from './AssetBrowser.module.css'

export interface AssetBrowserModalProps {
  assets: Asset[]
  teamSlug?: string
  teamId?: string
  allowedMimeTypes?: string[]
  isMultiSelect?: boolean
  initialSelectedIds?: string[]
  onClose: () => void
  onSelect?: (id: string) => void
  onSelectMultiple?: (ids: string[]) => void
}

function AssetBrowserModalContent() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    allowedMimeTypes,
    isMultiSelect,
    teamSlug,
    teamId,
    supabase,
    onClose,
    folders,
    setFolders,
    activeFolder,
    setActiveFolder,
    filesCache,
    setFilesCache,
    searchQuery,
    setSearchQuery,
    isFilterActive,
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    startItem,
    endItem,
    totalItems,
    totalPages,
    paginatedAssets
  } = useAssetBrowser()

  // Creation & Upload sub-modal states
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [showWidgetSelection, setShowWidgetSelection] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Local state setAssets handler
  const handleSetAssets = useCallback((updater: Asset[] | ((prev: Asset[]) => Asset[])) => {
    const activeId = activeFolder?.id || 'root'
    const currentFilesList = filesCache[activeId] || []
    const nextFilesList = typeof updater === 'function' ? updater(currentFilesList) : updater
    
    setFilesCache(prev => ({
      ...prev,
      [activeId]: nextFilesList.filter(a => a.mime_type !== 'application/x-folder')
    }))
  }, [activeFolder, filesCache, setFilesCache])

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  return (
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Asset Library</h3>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close browser" type="button">
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
                        Widgets
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
                type="button"
                className={`${styles.filterToggleBtn} ${showFilters || isFilterActive ? styles.active : ''}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Filter size={14} />
                Filters
                {isFilterActive && <span className={styles.filterDot} />}
              </button>

              <div className={styles.viewToggleGroup}>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
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
            <AssetBrowserBreadcrumbs />
            
            {paginatedAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <h4 className={styles.emptyText}>No assets match your query.</h4>
              </div>
            ) : viewMode === 'table' ? (
              <AssetBrowserTable />
            ) : (
              <AssetBrowserGrid />
            )}
          </div>

          <AssetBrowserSidebar isOpen={showFilters} onClose={() => setShowFilters(false)} />
        </div>

        <div className={styles.footer}>
          <div>
            Showing {startItem} to {endItem} of {totalItems} assets
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  className={`${styles.pageBtn} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <AssetBrowserSelection />
      </div>

      {/* Hidden file uploader */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files))
          }
        }}
      />

      {/* Upload Panel Overlay */}
      {showQueuePanel && (
        <UploadPanel
          showQueuePanel={showQueuePanel}
          uploadQueue={uploadQueue}
          isQueueCollapsed={isQueueCollapsed}
          setIsQueueCollapsed={setIsQueueCollapsed}
          setShowQueuePanel={setShowQueuePanel}
          setUploadQueue={setUploadQueue}
        />
      )}

      {/* Widget Selection & Creation Modals */}
      {teamSlug && (
        <WidgetModalsContainer
          showWidgetSelection={showWidgetSelection}
          setShowWidgetSelection={setShowWidgetSelection}
          teamSlug={teamSlug}
          assets={folders} // folders state is actually assets array for container context
          setAssets={() => {}} // dummy updater
          setShowSuccess={() => {}}
          folderId={activeFolder?.id || null}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && teamSlug && (
        <CreateFolderModal
          onClose={() => setShowCreateFolder(false)}
          onSuccess={handleCreateFolderSuccess}
          teamSlug={teamSlug}
          parentFolderId={activeFolder?.id || null}
        />
      )}
    </div>
  )
}

export function AssetBrowserModal(props: AssetBrowserModalProps) {
  return (
    <AssetBrowserProvider {...props}>
      <AssetBrowserModalContent />
    </AssetBrowserProvider>
  )
}
export default AssetBrowserModal
