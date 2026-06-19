'use client'

import { useTransition, useRef, useState, useMemo, useCallback } from 'react'
import { Folder, FolderPlus, X, Search, ChevronRight, Home } from 'lucide-react'
import { Asset } from './types'
import { useTranslation } from '@/lib/i18n'
import styles from './Modal.module.css'
import listStyles from './BulkMoveModal.module.css'
import Modal from '../components/Modal'
import { CreateFolderModal } from './CreateFolderModal'

export function BulkMoveModal({
  selectedAssets,
  folders,
  teamSlug,
  onClose,
  onMoveAssets,
  onFolderCreated,
}: {
  selectedAssets: Asset[]
  folders: Asset[]
  teamSlug: string
  onClose: () => void
  onMoveAssets: (assetIds: string[], targetFolderId: string | null, targetFolderName: string) => void
  onFolderCreated?: (folder: Asset) => void
}) {
  const { t } = useTranslation()
  const [isPending] = useTransition()
  
  // Navigation states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedTargetFolderId, setSelectedTargetFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Stacked folder creation modal state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)

  const selectedFolderIds = useMemo(() => {
    return new Set(selectedAssets.filter(a => a.mime_type === 'application/x-folder').map(a => a.id))
  }, [selectedAssets])

  const isDescendantOfSelected = useCallback((folderId: string | null): boolean => {
    if (!folderId) return false
    let currentId: string | null = folderId
    const visited = new Set<string>()
    while (currentId) {
      if (visited.has(currentId)) {
        console.error('[BulkMoveModal] Circular folder dependency detected in isDescendantOfSelected at:', currentId)
        break
      }
      visited.add(currentId)
      if (selectedFolderIds.has(currentId)) return true
      const parentFolder = folders.find(f => f.id === currentId)
      currentId = parentFolder ? (parentFolder.folder_id || null) : null
    }
    return false
  }, [selectedFolderIds, folders])

  const isFolderDisabled = useCallback((folderId: string) => {
    return selectedFolderIds.has(folderId) || isDescendantOfSelected(folderId)
  }, [selectedFolderIds, isDescendantOfSelected])

  // Compute Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: t('Root') }]
    if (!currentFolderId) return crumbs

    const path: { id: string; name: string }[] = []
    let currId: string | null = currentFolderId
    const visited = new Set<string>()
    while (currId) {
      if (visited.has(currId)) {
        console.error('[BulkMoveModal] Circular folder dependency detected in breadcrumbs at:', currId)
        break
      }
      visited.add(currId)
      const folder = folders.find(f => f.id === currId)
      if (folder) {
        path.push({ id: folder.id, name: folder.file_name })
        currId = folder.folder_id || null
      } else {
        break
      }
    }
    path.reverse()
    return [...crumbs, ...path]
  }, [currentFolderId, folders])

  // Filter folders at the current level or match search query globally
  const displayedFolders = useMemo(() => {
    if (searchQuery.trim()) {
      return folders.filter(f => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return folders.filter(f => f.folder_id === currentFolderId)
  }, [folders, currentFolderId, searchQuery])

  function handleRowClick(folder: Asset) {
    if (isFolderDisabled(folder.id)) return
    setSelectedTargetFolderId(folder.id)
  }

  function handleNavigateInto(folder: Asset, e: React.MouseEvent) {
    e.stopPropagation()
    if (isFolderDisabled(folder.id)) return
    setCurrentFolderId(folder.id)
    setSelectedTargetFolderId(folder.id)
    setSearchQuery('')
  }

  function handleBreadcrumbClick(folderId: string | null) {
    setCurrentFolderId(folderId)
    setSelectedTargetFolderId(folderId)
    setSearchQuery('')
  }

  function handleMove() {
    const assetIds = selectedAssets.map(a => a.id)
    const targetName = selectedTargetFolderId
      ? (folders.find(f => f.id === selectedTargetFolderId)?.file_name || t('Folder'))
      : t('Root')
    onMoveAssets(assetIds, selectedTargetFolderId, targetName)
    onClose()
  }

  const currentLocationName = useMemo(() => {
    if (!currentFolderId) return t('Root')
    return folders.find(f => f.id === currentFolderId)?.file_name || t('Folder')
  }, [currentFolderId, folders])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Move')}
      subtitle={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          <span style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontWeight: 600 }}>
            {selectedAssets.length} {selectedAssets.length === 1 ? t('item') : t('items')}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-subtle)' }}>
            {t('Current location:')} <strong style={{ color: 'var(--primary)' }}>{currentLocationName}</strong>
          </span>
        </div>
      }
      maxWidth="480px"
    >
      {/* Search Folders */}
      <div className={listStyles.searchBar}>
        <Search size={16} className={listStyles.searchIcon} />
        <input
          type="text"
          className={listStyles.searchInput}
          placeholder={t('Search folders…')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: 'var(--on-surface-subtle)', cursor: 'pointer' }}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Breadcrumb Navigation (only in non-search mode) */}
      {!searchQuery && (
        <div className={listStyles.breadcrumbs}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <span key={crumb.id || 'root'} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {idx > 0 && <span className={listStyles.breadcrumbSeparator}><ChevronRight size={12} /></span>}
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(crumb.id)}
                  disabled={isLast}
                  className={`${listStyles.breadcrumbCrumb} ${isLast ? listStyles.breadcrumbCrumbActive : ''}`}
                >
                  {crumb.name}
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Toolbar with New Folder action */}
      <div className={listStyles.toolbar}>
        <span className={listStyles.toolbarTitle}>
          {searchQuery ? t('Search Results') : t('Folders')}
        </span>
        {!searchQuery && (
          <button
            type="button"
            className={listStyles.newFolderBtn}
            onClick={() => setShowCreateFolderModal(true)}
          >
            <FolderPlus size={14} />
            {t('New Folder')}
          </button>
        )}
      </div>

      <div className={listStyles.list}>
        {/* Root Level Navigation row (only when inside a folder and not searching) */}
        {!currentFolderId && !searchQuery && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setSelectedTargetFolderId(null)}
            className={`${listStyles.listRow} ${selectedTargetFolderId === null ? listStyles.listRowSelected : ''}`}
          >
            <div className={listStyles.folderInfo}>
              <Home size={18} style={{ stroke: '#78716c', flexShrink: 0 }} />
              <span className={listStyles.folderLabel}>
                <span className={listStyles.folderName}>{t('Root')}</span>
                <span className={listStyles.folderHint}>{t('Move to top level')}</span>
              </span>
            </div>
          </button>
        )}

        {/* List of folders */}
        {displayedFolders.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--on-surface-subtle)', fontSize: '0.86rem' }}>
            {searchQuery ? t('No matching folders found.') : t('No folders here yet.')}
          </div>
        ) : (
          displayedFolders.map(f => {
            const isDisabled = isFolderDisabled(f.id)
            const isSelected = selectedTargetFolderId === f.id
            const isDirectChild = f.folder_id === currentFolderId

            return (
              <div
                key={f.id}
                className={`${listStyles.listRow} ${isSelected ? listStyles.listRowSelected : ''} ${isDisabled ? listStyles.listRowDisabled : ''}`}
                onClick={() => !isDisabled && handleRowClick(f)}
              >
                <div className={listStyles.folderInfo}>
                  <Folder size={18} style={{ stroke: f.color || '#78716c', fill: f.color || '#78716c', fillOpacity: 0.15, flexShrink: 0 }} />
                  <span className={listStyles.folderLabel}>
                    <span className={listStyles.folderName}>{f.file_name}</span>
                    {!isDirectChild && f.folder_id && (
                      <span className={listStyles.folderHint}>
                        {t('Path: ')}{folders.find(p => p.id === f.folder_id)?.file_name || 'Root'}
                      </span>
                    )}
                  </span>
                </div>
                {!isDisabled && (
                  <button
                    className={listStyles.goInsideBtn}
                    onClick={(e) => handleNavigateInto(f, e)}
                    title={t('Open folder')}
                    aria-label={`${t('Open')} ${f.file_name}`}
                    type="button"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className={listStyles.footer}>
        <button className={listStyles.secondaryBtn} onClick={onClose} disabled={isPending} type="button">
          {t('Cancel')}
        </button>
        <button
          className={listStyles.primaryBtn}
          onClick={handleMove}
          disabled={isPending || selectedAssets.every(a => (a.folder_id || null) === selectedTargetFolderId)}
          type="button"
        >
          {t('Move Here')}
        </button>
      </div>

      {showCreateFolderModal && (
        <CreateFolderModal
          teamSlug={teamSlug}
          parentFolderId={currentFolderId}
          onClose={() => setShowCreateFolderModal(false)}
          onSuccess={(id, name, color) => {
            const newFolder: Asset = {
              id,
              file_name: name,
              file_path: 'folder',
              mime_type: 'application/x-folder',
              size_bytes: 0,
              created_at: new Date().toISOString(),
              folder_id: currentFolderId,
              color: color
            }
            onFolderCreated?.(newFolder)
            setSelectedTargetFolderId(id)
            setShowCreateFolderModal(false)
          }}
          overlayStyle={{ zIndex: 1100 }}
        />
      )}
    </Modal>
  )
}
