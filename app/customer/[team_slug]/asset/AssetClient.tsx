'use client'

import { useState, useRef, useEffect, useCallback, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Check, File, Plus, RefreshCw, Upload, ChevronLeft, ChevronRight, Trash2, FolderPlus, FolderInput, Folder, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import { moveAssetsToFolder, fetchFolderFiles } from './actions'
import { toast } from '@/app/components/Toast'
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
import { WidgetEditContainer } from './WidgetEditContainer'
import { CreateFolderModal } from './CreateFolderModal'
import { BulkMoveModal } from './BulkMoveModal'
import { PushToScreenModal } from './PushToScreenModal'
import { t } from '@/lib/i18n'
import styles from './asset.module.css'

interface Props {
  initialFolders: Asset[]
  initialFiles: Asset[]
  screens: ScreenDevice[]
  teamId: string
  teamSlug: string
  totalAssets?: number
  currentPage?: number
  pageSize?: number
  folder?: Asset
}

const EMPTY_FILES_ARRAY: Asset[] = []

export default function AssetClient({
  initialFolders,
  initialFiles,
  screens,
  teamId,
  teamSlug,
  totalAssets = 0,
  currentPage: initialCurrentPage = 1,
  pageSize: initialPageSize = 10,
  folder,
}: Props) {
  const [folders, setFolders] = useState<Asset[]>(initialFolders)
  const [filesCache, setFilesCache] = useState<Record<string, Asset[]>>(() => {
    const cache: Record<string, Asset[]> = {}
    initialFiles.forEach(file => {
      const key = file.folder_id || 'root'
      if (!cache[key]) cache[key] = []
      cache[key].push(file)
    })
    return cache
  })
  const [activeFolder, setActiveFolder] = useState<Asset | null>(folder || null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Derived state to keep components fully compatible with the old assets variable
  const currentFiles = useMemo(() => 
    filesCache[activeFolder?.id || 'root'] || EMPTY_FILES_ARRAY,
    [filesCache, activeFolder]
  )
  const currentSubfolders = useMemo(() => 
    folders.filter(f => (f.folder_id || null) === (activeFolder?.id || null)),
    [folders, activeFolder]
  )
  const assets = useMemo(() => [...currentSubfolders, ...currentFiles], [currentSubfolders, currentFiles])

  // Custom setAssets wrapper to update folders and filesCache dynamically
  const setAssets = useCallback((updater: Asset[] | ((prev: Asset[]) => Asset[])) => {
    const activeId = activeFolder?.id || 'root'
    const currentFilesList = filesCache[activeId] || []
    const currentSubfoldersList = folders.filter(f => (f.folder_id || null) === (activeFolder?.id || null))
    const currentCombined = [...currentSubfoldersList, ...currentFilesList]

    const nextCombined = typeof updater === 'function' ? updater(currentCombined) : updater

    const updatedFolders = nextCombined.filter(a => a.mime_type === 'application/x-folder')
    const updatedFiles = nextCombined.filter(a => a.mime_type !== 'application/x-folder')

    setFolders(prev => {
      const map = new Map(prev.map(f => [f.id, f]))
      updatedFolders.forEach(f => {
        map.set(f.id, f)
      })
      const currentSubfolderIds = new Set(currentSubfoldersList.map(f => f.id))
      const updatedSubfolderIds = new Set(updatedFolders.map(f => f.id))
      currentSubfolderIds.forEach(id => {
        if (!updatedSubfolderIds.has(id)) {
          map.delete(id)
        }
      })
      return Array.from(map.values())
    })

    const filesStillHere = updatedFiles.filter(f => (f.folder_id || null) === (activeFolder?.id || null))
    setFilesCache(prev => {
      const next = { ...prev }
      next[activeId] = filesStillHere

      // Add moved/added files to their respective target folder caches if they exist
      updatedFiles.forEach(f => {
        const targetId = f.folder_id || 'root'
        if (targetId !== activeId) {
          const targetList = next[targetId] || []
          if (!targetList.some(item => item.id === f.id)) {
            next[targetId] = [...targetList, f]
          }
        }
      })

      // Clean up deleted files from all caches
      const updatedFilesIds = new Set(updatedFiles.map(file => file.id))
      currentFilesList.forEach(file => {
        if (!updatedFilesIds.has(file.id)) {
          Object.keys(next).forEach(key => {
            next[key] = (next[key] || []).filter(item => item.id !== file.id)
          })
        }
      })

      return next
    })
  }, [folders, filesCache, activeFolder])

  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  
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
  const [filterDatePreset, setFilterDatePreset] = useState<string>('custom')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [filterSizePreset, setFilterSizePreset] = useState<string>('custom')
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
    folderId: activeFolder?.id,
  })

  useEffect(() => {
    const saved = localStorage.getItem('assetsViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setFolders(initialFolders)
    
    // Group all initial files by folder_id
    const newCache: Record<string, Asset[]> = {}
    initialFiles.forEach(file => {
      const key = file.folder_id || 'root'
      if (!newCache[key]) newCache[key] = []
      newCache[key].push(file)
    })
    setFilesCache(newCache)
  }, [initialFolders, initialFiles])

  useEffect(() => {
    setActiveFolder(folder || null)
  }, [folder])

  // Caching: SWR file fetcher
  const loadFolderFiles = useCallback(async (folderId: string | null) => {
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
        toast.error(result.error || t('Failed to refresh folder contents.'))
      }
    } catch (err) {
      console.error('[loadFolderFiles] error:', err)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [teamSlug, filesCache, t])

  useEffect(() => {
    loadFolderFiles(activeFolder?.id || null)
  }, [activeFolder])

  const resolveFolderFromPath = useCallback((pathStr: string | null): Asset | null => {
    if (!pathStr || pathStr === '/') return null
    const segments = pathStr.split('/').filter(Boolean)
    if (segments.length === 0) return null

    let currentParentId: string | null = null
    let currentFolder: Asset | null = null

    for (const segment of segments) {
      const decodedSegment = decodeURIComponent(segment)
      const found = folders.find(f => 
        f.mime_type === 'application/x-folder' &&
        (f.folder_id || null) === currentParentId &&
        f.file_name.toLowerCase() === decodedSegment.toLowerCase()
      )
      if (!found) return null
      currentFolder = found
      currentParentId = found.id
    }
    return currentFolder
  }, [folders])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const pathParam = params.get('path') || '/'
      const resolved = resolveFolderFromPath(pathParam)
      setActiveFolder(resolved)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [resolveFolderFromPath])

  const navigateToFolder = useCallback((targetFolder: Asset | null, pathStr: string) => {
    setActiveFolder(targetFolder)
    const queryParam = pathStr === '/' ? '' : `?path=${pathStr}`
    window.history.pushState(null, '', `/customer/${teamSlug}/asset${queryParam}`)
  }, [teamSlug])

  const breadcrumbs = useMemo(() => {
    const list: { name: string; folder: Asset | null; path: string }[] = [
      { name: 'Root', folder: null, path: '/' }
    ]
    if (!activeFolder) return list

    const pathSegments: Asset[] = [activeFolder]
    let currentId = activeFolder.folder_id
    while (currentId) {
      const parentFolder = folders.find(f => f.id === currentId && f.mime_type === 'application/x-folder')
      if (!parentFolder) break
      pathSegments.unshift(parentFolder)
      currentId = parentFolder.folder_id
    }

    let currentPath = ''
    for (const f of pathSegments) {
      currentPath += '/' + encodeURIComponent(f.file_name)
      list.push({
        name: f.file_name,
        folder: f,
        path: currentPath
      })
    }
    return list
  }, [activeFolder, folders])

  const [dragOverBreadcrumbIndex, setDragOverBreadcrumbIndex] = useState<number | null>(null)

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
  const previewUrlsRef = useRef(previewUrls)
  useEffect(() => {
    previewUrlsRef.current = previewUrls
  }, [previewUrls])

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [isBreadcrumbDragOver, setIsBreadcrumbDragOver] = useState(false)

  const moveAssetsOptimistically = useCallback(async (assetIds: string[], targetFolderId: string | null, targetFolderName: string) => {
    const previousAssets = [...assets]
    const previousSelected = new Set(selectedAssetIds)

    setAssets(prev => prev.map(a => {
      if (assetIds.includes(a.id)) {
        return { ...a, folder_id: targetFolderId }
      }
      return a
    }))
    setSelectedAssetIds(new Set())

    toast.success(
      `${t('Moved')} ${assetIds.length} ${assetIds.length === 1 ? t('item') : t('items')} ${t('to')} ${targetFolderName}`
    )

    try {
      const result = await moveAssetsToFolder(teamSlug, assetIds, targetFolderId)
      if (result.success) {
        router.refresh()
        return true
      } else {
        setAssets(previousAssets)
        setSelectedAssetIds(previousSelected)
        toast.error(result.error || t('Failed to move assets.'))
        return false
      }
    } catch (err) {
      setAssets(previousAssets)
      setSelectedAssetIds(previousSelected)
      toast.error(t('Failed to move assets due to a network error.'))
      return false
    }
  }, [assets, selectedAssetIds, teamSlug, router])

  const handleMoveDrop = useCallback((draggedId: string, targetFolderId: string | null, targetFolderName: string) => {
    const draggedIds = draggedId.split(',').map(x => x.trim()).filter(Boolean)
    let finalIds = [...draggedIds]
    const hasSelection = draggedIds.some(id => selectedAssetIds.has(id))
    if (hasSelection) {
      finalIds = Array.from(selectedAssetIds)
    }

    const sanitized = finalIds.filter(id => id && id !== targetFolderId)
    if (sanitized.length === 0) return

    moveAssetsOptimistically(sanitized, targetFolderId, targetFolderName)
  }, [selectedAssetIds, moveAssetsOptimistically])

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

      const existing = previewUrlsRef.current
      const missing = targetAssets.filter(item => !existing.has(item.originalPath))
      const existingKeys = new Set(targetAssets.map(item => item.originalPath))

      const results = missing.length === 0
        ? []
        : await Promise.all(
            missing.map(async (item) => {
              const url = await getCachedSignedUrl(supabase, item.filePathToSign, 3600)
              return { path: item.originalPath, url }
            })
          )
      if (cancelled) return

      const hasPruned = Array.from(existing.keys()).some(key => !existingKeys.has(key))
      const hasAdded = results.some(res => res.url && !existing.has(res.path))

      if (hasPruned || hasAdded) {
        setPreviewUrls(prev => {
          const next = new Map(prev)
          // Prune URLs for assets that no longer exist (keeps memory bounded).
          Array.from(next.keys()).forEach(key => {
            if (!existingKeys.has(key)) next.delete(key)
          })
          for (const res of results) {
            if (res.url) next.set(res.path, res.url)
          }
          return next
        })
      }
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
      const [foldersRes, filesRes] = await Promise.all([
        supabase.from('assets').select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color').eq('team_id', teamId).eq('mime_type', 'application/x-folder'),
        fetchFolderFiles(teamSlug, activeFolder?.id || null)
      ])
      
      if (foldersRes.data) {
        setFolders(foldersRes.data as Asset[])
      }
      if (filesRes.success && filesRes.files) {
        setFilesCache(prev => ({
          ...prev,
          [activeFolder?.id || 'root']: filesRes.files as Asset[]
        }))
      }
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
      const pathSegments: string[] = [asset.file_name]
      let currentId = asset.folder_id
      while (currentId) {
        const parentFolder = folders.find(f => f.id === currentId && f.mime_type === 'application/x-folder')
        if (!parentFolder) break
        pathSegments.unshift(parentFolder.file_name)
        currentId = parentFolder.folder_id
      }
      const pathStr = '/' + pathSegments.map(encodeURIComponent).join('/')
      navigateToFolder(asset, pathStr)
    } else if (isWidget(asset.mime_type) && asset.mime_type !== 'application/x-widget-qrcode') {
      setEditingAsset(asset)
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

  const allLoadedAssets = useMemo(() => {
    return [...folders, ...Object.values(filesCache).flat()]
  }, [folders, filesCache])

  const filteredAssets = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const today = new Date().setHours(0,0,0,0)
    
    const filtered = allLoadedAssets.filter(a => {
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
        if (activeFolder) {
          return matchesSearch && a.folder_id === activeFolder.id
        }
        return matchesSearch
      }
      
      // Root level assets (or folders) when no search is active, or assets within the active folder
      return activeFolder ? a.folder_id === activeFolder.id : !a.folder_id
    })

    // Sort folders at the top, then by created_at descending
    return filtered.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/x-folder'
      const bIsFolder = b.mime_type === 'application/x-folder'
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [allLoadedAssets, filterType, filterDatePreset, filterStartDate, filterEndDate, filterSizePreset, filterMinSize, filterMaxSize, searchQuery, activeFolder])

  const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = filteredAssets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredAssets.length)

  // Clamp current page when filters reduce results.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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

  const folderAssetsCount = useMemo(() => {
    if (!activeFolder) return 0
    return (filesCache[activeFolder.id] || []).length
  }, [filesCache, activeFolder])

  const hasActiveFilters = 
    filterType !== 'all' ||
    (filterDatePreset !== 'all' && (filterDatePreset !== 'custom' || filterStartDate !== '' || filterEndDate !== '')) ||
    (filterSizePreset !== 'all' && (filterSizePreset !== 'custom' || filterMinSize !== '' || filterMaxSize !== ''))

  const isFiltersActive = isFilterSidebarOpen || hasActiveFilters
  const showFilterDot = hasActiveFilters

  return (
    <div className={styles.assetArea}>
      <div className={`${styles.topbar} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div>
          <div className={styles.titleContainer}>
            <h1 className={styles.pageTitle}>{t('Asset Library')}</h1>
            <button
              className={styles.headerRefreshBtn}
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh Status"
              title="Refresh Status"
              type="button"
            >
              <RefreshCw size={16} className={isRefreshing ? styles.spin : ''} />
            </button>
          </div>
          
          <p className={styles.pageSubtitle}>
            {activeFolder ? (
              folderAssetsCount > 0
                ? `${folderAssetsCount} ${folderAssetsCount === 1 ? t('asset') : t('assets')} ${t('in this folder.')}`
                : t('This folder is empty.')
            ) : (
              totalAssets > 0
                ? `${totalAssets} ${totalAssets === 1 ? t('asset') : t('assets')} ${t('in your library.')}`
                : t('Upload images and videos to get started.')
            )}
            {isLoadingFiles && (
              <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--on-surface-subtle)' }}>
                {t('Loading...')}
              </span>
            )}
          </p>

          <div className={styles.breadcrumbContainer} style={{ marginTop: '8px' }}>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1
              const isDragOver = dragOverBreadcrumbIndex === index
              
              return (
                <span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {index > 0 && <span className={styles.breadcrumbSeparator}>&gt;</span>}
                  <button
                    type="button"
                    onClick={() => navigateToFolder(item.folder, item.path)}
                    className={`${isLast ? styles.breadcrumbActive : styles.breadcrumbLink} ${isDragOver ? styles.breadcrumbDragOver : ''}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDragOverBreadcrumbIndex(index)
                    }}
                    onDragLeave={() => {
                      setDragOverBreadcrumbIndex(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverBreadcrumbIndex(null)
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
                      const targetFolderId = item.folder ? item.folder.id : null
                      const targetFolderName = item.name
                      
                      const sanitized = ids.filter(id => id && id !== targetFolderId)
                      if (sanitized.length === 0) return

                      moveAssetsOptimistically(sanitized, targetFolderId, targetFolderName)
                    }}
                  >
                    {item.folder && (
                      <Folder size={16} style={{ stroke: item.folder.color || '#78716c', fill: item.folder.color || '#78716c', fillOpacity: 0.15 }} />
                    )}
                    {item.name === 'Root' ? t('Root') : item.name}
                  </button>
                </span>
              )
            })}
          </div>
        </div>
        <div className={styles.topbarActions}>
          <button
            type="button"
            onClick={() => setShowCreateFolder(true)}
            className={styles.topbarActionBtn}
          >
            <FolderPlus size={16} />
            {t('New Folder')}
          </button>
          <button
            type="button"
            onClick={() => setShowWidgetSelection(true)}
            className={styles.topbarActionBtn}
          >
            <Plus size={16} />
            {t('Create Widget')}
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${styles.topbarActionBtn} ${styles.topbarPrimaryBtn}`}
          >
            <Upload size={16} />
            {t('Upload Media')}
          </button>
        </div>
      </div>



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
                  aria-label={t('Search assets')}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && searchQuery) setSearchQuery('')
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => setSearchQuery('')}
                    aria-label={t('Clear search')}
                    title={t('Clear search')}
                  >
                    <X size={16} />
                  </button>
                )}
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
                      aria-label={t('Move to Folder')}
                      type="button"
                    >
                      <FolderInput size={16} />
                    </button>
                    <button
                      className={`${styles.bulkActionIconBtn} ${styles.bulkActionIconBtnDanger}`}
                      onClick={() => setShowBulkDeleteModal(true)}
                      title={t('Delete Selected Assets')}
                      aria-label={t('Delete Selected Assets')}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className={styles.bulkActionIconBtn}
                      onClick={() => setSelectedAssetIds(new Set())}
                      title={t('Clear selection')}
                      aria-label={t('Clear selection')}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <button 
                  className={`${styles.filterBtn} ${isFiltersActive ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                  id="assets-filter-button"
                  type="button"
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
                      aria-label={t('Table View')}
                      type="button"
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
                      aria-label={t('Grid View')}
                      type="button"
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
                    screens={screens}
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
                        const right = Math.max(8, window.innerWidth - rect.right)
                        setMenuPosition({ top: rect.bottom + window.scrollY + 6, right })
                        setOpenMenuId(asset.id)
                      }
                    }}
                    selected={selectedAssetIds.has(asset.id)}
                      onToggleSelect={() => handleToggleSelect(asset.id)}
                      isSelectionActive={selectedAssetIds.size > 0}
                    draggable={!deletingIds.has(asset.id)}
                    isDropTarget={dragOverFolderId === asset.id && asset.mime_type === 'application/x-folder'}
                    onDragStart={(e) => {
                      if (deletingIds.has(asset.id)) return
                      const ids = (selectedAssetIds.size > 0 && selectedAssetIds.has(asset.id))
                        ? Array.from(selectedAssetIds)
                        : [asset.id]
                      e.dataTransfer.setData('application/x-nuexis-asset-ids', JSON.stringify(ids))
                      e.dataTransfer.setData('text/plain', ids.join(','))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDragOverFolderId(null)
                    }}
                    onDragOver={(e) => {
                      if (asset.mime_type !== 'application/x-folder') return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverFolderId(asset.id)
                    }}
                    onDrop={(e) => {
                      if (asset.mime_type !== 'application/x-folder') return
                      e.preventDefault()
                      setDragOverFolderId(null)
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

                      moveAssetsOptimistically(sanitized, asset.id, asset.file_name)
                    }}
                    />
                ))}
              </div>
            ) : (
              <div className={showSuccessPulse ? styles.successPulse : ''}>
                <AssetTableView
                  filteredAssets={paginatedAssets}
                  screens={screens}
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
                  dragOverFolderId={dragOverFolderId}
                  setDragOverFolderId={setDragOverFolderId}
                  onDropOnFolder={(targetFolder, draggedIds) => {
                    moveAssetsOptimistically(draggedIds, targetFolder.id, targetFolder.file_name)
                  }}
                />
              </div>
            )}
            
            {filteredAssets.length > 0 && (
              <div className={styles.tableFooter}>
                <div className={styles.paginationInfo}>
                  {`${t('Showing')} ${startItem} ${t('to')} ${endItem} ${t('of')} ${filteredAssets.length} ${t('items')}`}
                  {viewMode === 'grid' && filteredAssets.some(a => a.mime_type === 'application/x-folder') && (
                    <span className={styles.dragHint}>{t('Tip: drag items onto a folder to move them')}</span>
                  )}
                </div>
                <div className={styles.footerControls}>
                  <div className={styles.perPageSelector}>
                    <span>{t('Per page:')}</span>
                    <select
                      value={String(pageSize)}
                      onChange={(e) => {
                        const val = e.target.value
                        navigatePage(1, Number(val))
                      }}
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  <div className={styles.pagination}>
                    <span className={styles.pageIndicator}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => navigatePage(currentPage - 1, pageSize)}
                      disabled={!hasPrevPage}
                      type="button"
                      aria-label={t('Previous page')}
                      style={{ cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => navigatePage(currentPage + 1, pageSize)}
                      disabled={!hasNextPage}
                      type="button"
                      aria-label={t('Next page')}
                      style={{ cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
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
          triggerId="assets-filter-button"
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
        folderId={activeFolder?.id}
      />

      {editingAsset && (
        <WidgetEditContainer
          asset={editingAsset}
          teamSlug={teamSlug}
          onClose={() => setEditingAsset(null)}
          onUpdated={(updatedAsset) => {
            setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a))
          }}
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

      {showCreateFolder && (
        <CreateFolderModal
          teamSlug={teamSlug}
          onClose={() => setShowCreateFolder(false)}
          onSuccess={(id, name, color) => {
            const newFolder: Asset = {
              id,
              file_name: name,
              file_path: 'folder',
              mime_type: 'application/x-folder',
              size_bytes: 0,
              created_at: new Date().toISOString(),
              folder_id: activeFolder?.id || null,
              color: color
            }
            setFolders(prev => [newFolder, ...prev])
            setShowCreateFolder(false)
            router.refresh()
          }}
          parentFolderId={activeFolder?.id || null}
        />
      )}

      {showBulkMoveModal && (
        <BulkMoveModal
          selectedAssets={assets.filter(a => selectedAssetIds.has(a.id))}
          folders={folders.filter(a => a.mime_type === 'application/x-folder' && (!activeFolder || a.id !== activeFolder.id))}
          teamSlug={teamSlug}
          onClose={() => setShowBulkMoveModal(false)}
          onMoveAssets={(assetIds, targetFolderId, targetFolderName) => {
            moveAssetsOptimistically(assetIds, targetFolderId, targetFolderName)
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
