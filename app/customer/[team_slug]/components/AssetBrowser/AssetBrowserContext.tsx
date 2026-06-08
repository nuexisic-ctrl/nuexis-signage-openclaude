'use client'

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Asset } from '../../asset/types'
import { fetchFolderFiles } from '../../asset/actions'
import { toast } from '@/app/components/Toast'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'

export interface AssetBrowserContextType {
  // Config
  allowedMimeTypes?: string[]
  isMultiSelect?: boolean
  teamSlug?: string
  teamId?: string
  supabase: any
  onClose: () => void
  onSelect?: (id: string) => void
  onSelectMultiple?: (ids: string[]) => void

  // Navigation & Cache
  folders: Asset[]
  setFolders: React.Dispatch<React.SetStateAction<Asset[]>>
  activeFolder: Asset | null
  setActiveFolder: (folder: Asset | null) => void
  isLoadingFiles: boolean
  filesCache: Record<string, Asset[]>
  setFilesCache: React.Dispatch<React.SetStateAction<Record<string, Asset[]>>>
  loadFolderFiles: (folderId: string | null) => Promise<void>
  breadcrumbs: { name: string; folder: Asset | null }[]

  // Search & Filters
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedType: string
  setSelectedType: (type: string) => void
  filterDatePreset: string
  setFilterDatePreset: (preset: string) => void
  filterStartDate: string
  setFilterStartDate: (date: string) => void
  filterEndDate: string
  setFilterEndDate: (date: string) => void
  filterSizePreset: string
  setFilterSizePreset: (preset: string) => void
  filterMinSize: string
  setFilterMinSize: (size: string) => void
  filterMaxSize: string
  setFilterMaxSize: (size: string) => void
  isFilterActive: boolean
  clearFilters: () => void
  sortBy: string
  setSortBy: (val: string) => void

  // Layout & Pagination
  viewMode: 'grid' | 'table'
  setViewMode: (mode: 'grid' | 'table') => void
  currentPage: number
  setCurrentPage: (page: number) => void
  pageSize: number
  totalItems: number
  totalPages: number
  startItem: number
  endItem: number
  filteredAssets: Asset[]
  paginatedAssets: Asset[]
  previewUrls: Record<string, string>

  // Selection
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  clearSelection: () => void
}

const AssetBrowserContext = createContext<AssetBrowserContextType | undefined>(undefined)

export function useAssetBrowser() {
  const context = useContext(AssetBrowserContext)
  if (!context) {
    throw new Error('useAssetBrowser must be used within an AssetBrowserProvider')
  }
  return context
}

interface ProviderProps {
  assets: Asset[]
  allowedMimeTypes?: string[]
  isMultiSelect?: boolean
  teamSlug?: string
  teamId?: string
  initialSelectedIds?: string[]
  onClose: () => void
  onSelect?: (id: string) => void
  onSelectMultiple?: (ids: string[]) => void
  children: React.ReactNode
}

export function AssetBrowserProvider({
  assets,
  allowedMimeTypes,
  isMultiSelect = false,
  teamSlug,
  teamId,
  initialSelectedIds = [],
  onClose,
  onSelect,
  onSelectMultiple,
  children
}: ProviderProps) {
  const supabase = useMemo(() => createClient(), [])

  // Folder navigation and caching
  const [folders, setFolders] = useState<Asset[]>(() => assets.filter(a => a.mime_type === 'application/x-folder'))
  const [filesCache, setFilesCache] = useState<Record<string, Asset[]>>(() => {
    const rootFiles = assets.filter(a => a.mime_type !== 'application/x-folder' && !a.folder_id)
    return { root: rootFiles }
  })
  const [activeFolder, setActiveFolder] = useState<Asset | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Synchronize initial folder list when assets prop updates
  useEffect(() => {
    setFolders(assets.filter(a => a.mime_type === 'application/x-folder'))
  }, [assets])

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

  // Breadcrumbs Helper
  const breadcrumbs = useMemo(() => {
    const list: { name: string; folder: Asset | null }[] = [{ name: 'Root', folder: null }]
    if (!activeFolder) return list

    const pathSegments: Asset[] = [activeFolder]
    let currentId = activeFolder.folder_id
    while (currentId) {
      const parentFolder = folders.find(f => f.id === currentId && f.mime_type === 'application/x-folder')
      if (!parentFolder) break
      pathSegments.unshift(parentFolder)
      currentId = parentFolder.folder_id
    }

    for (const f of pathSegments) {
      list.push({ name: f.file_name, folder: f })
    }
    return list
  }, [activeFolder, folders])

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<string>('created-desc')
  const [selectedType, setSelectedType] = useState('all')
  const [filterDatePreset, setFilterDatePreset] = useState('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [filterSizePreset, setFilterSizePreset] = useState('all')
  const [filterMinSize, setFilterMinSize] = useState('')
  const [filterMaxSize, setFilterMaxSize] = useState('')

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('assetBrowserViewMode')
      if (saved === 'grid' || saved === 'table') return saved
    }
    return 'table'
  })

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Filtering Logic
  const allLoadedAssets = useMemo(() => {
    return [...folders, ...Object.values(filesCache).flat()]
  }, [folders, filesCache])

  const allowedFilteredAssets = useMemo(() => {
    if (!allowedMimeTypes) return allLoadedAssets
    return allLoadedAssets.filter(asset => {
      if (asset.mime_type === 'application/x-folder') return true
      return allowedMimeTypes.some(type => asset.mime_type.startsWith(type))
    })
  }, [allLoadedAssets, allowedMimeTypes])

  const isFilterActive = useMemo(() => {
    return selectedType !== 'all' || filterDatePreset !== 'all' || filterSizePreset !== 'all'
  }, [selectedType, filterDatePreset, filterSizePreset])

  const clearFilters = useCallback(() => {
    setSelectedType('all')
    setFilterDatePreset('all')
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterSizePreset('all')
    setFilterMinSize('')
    setFilterMaxSize('')
  }, [])

  const filteredAssets = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const getContentTypeLabel = (mimeType: string): string => {
      if (mimeType === 'application/x-folder') return 'Folder'
      if (mimeType.startsWith('image/')) return 'Image'
      if (mimeType.startsWith('video/')) return 'Video'
      if (mimeType.startsWith('audio/')) return 'Audio'
      if (mimeType === 'application/pdf') return 'PDF'
      if (mimeType.startsWith('application/x-widget')) return 'Widget'
      return 'Document'
    }

    const filtered = allowedFilteredAssets.filter((asset) => {
      // Scope to active folder
      if (searchQuery) {
        const matchesSearch = asset.file_name.toLowerCase().includes(searchQuery.toLowerCase())
        if (activeFolder) {
          return matchesSearch && asset.folder_id === activeFolder.id
        }
        return matchesSearch
      }
      return activeFolder ? asset.folder_id === activeFolder.id : !asset.folder_id
    }).filter((asset) => {
      if (asset.mime_type === 'application/x-folder') {
        if (selectedType !== 'all') return false
        return true
      }

      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'image' && !asset.mime_type.startsWith('image/')) return false
        if (selectedType === 'video' && !asset.mime_type.startsWith('video/')) return false
        if (selectedType === 'audio' && !asset.mime_type.startsWith('audio/')) return false
        if (selectedType === 'pdf' && asset.mime_type !== 'application/pdf') return false
        if (selectedType === 'widget' && !asset.mime_type.startsWith('application/x-widget')) return false
        if (selectedType === 'folder' && asset.mime_type !== 'application/x-folder') return false
        if (selectedType === 'document' && (
          asset.mime_type.startsWith('image/') || 
          asset.mime_type.startsWith('video/') || 
          asset.mime_type.startsWith('audio/') || 
          asset.mime_type === 'application/pdf' || 
          asset.mime_type.startsWith('application/x-widget') || 
          asset.mime_type === 'application/x-folder'
        )) return false
      }

      // Date filter
      if (filterDatePreset !== 'all' && asset.created_at) {
        const created = new Date(asset.created_at).getTime()
        if (filterDatePreset === 'today' && created < today) return false
        if (filterDatePreset === '7days' && created < now.getTime() - 7 * 86400000) return false
        if (filterDatePreset === '30days' && created < now.getTime() - 30 * 86400000) return false
        if (filterDatePreset === 'custom') {
          if (filterStartDate && created < new Date(filterStartDate).getTime()) return false
          if (filterEndDate && created >= new Date(filterEndDate).getTime() + 86400000) return false
        }
      }

      // Size filter
      const mb = (asset.size_bytes ?? 0) / (1024 * 1024)
      if (filterSizePreset === 'under1' && mb >= 1) return false
      if (filterSizePreset === '1to10' && (mb < 1 || mb > 10)) return false
      if (filterSizePreset === '10to50' && (mb < 10 || mb > 50)) return false
      if (filterSizePreset === 'custom') {
        const min = parseFloat(filterMinSize)
        const max = parseFloat(filterMaxSize)
        if (!isNaN(min) && mb < min) return false
        if (!isNaN(max) && mb > max) return false
      }

      return true
    })

    // Sort folders at the top, then sort based on selected sortBy option
    return filtered.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/x-folder'
      const bIsFolder = b.mime_type === 'application/x-folder'
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      
      if (sortBy === 'name-asc') {
        return a.file_name.localeCompare(b.file_name, undefined, { sensitivity: 'base' })
      }
      if (sortBy === 'name-desc') {
        return b.file_name.localeCompare(a.file_name, undefined, { sensitivity: 'base' })
      }
      if (sortBy === 'type-asc') {
        const typeA = getContentTypeLabel(a.mime_type)
        const typeB = getContentTypeLabel(b.mime_type)
        return typeA.localeCompare(typeB)
      }
      if (sortBy === 'type-desc') {
        const typeA = getContentTypeLabel(a.mime_type)
        const typeB = getContentTypeLabel(b.mime_type)
        return typeB.localeCompare(typeA)
      }
      if (sortBy === 'created-asc') {
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
      }
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    })
  }, [allowedFilteredAssets, searchQuery, selectedType, filterDatePreset, filterStartDate, filterEndDate, filterSizePreset, filterMinSize, filterMaxSize, activeFolder, sortBy])

  // Pagination Logic
  const totalItems = filteredAssets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const paginatedAssets = useMemo(() => {
    const fromIndex = (currentPage - 1) * pageSize
    return filteredAssets.slice(fromIndex, fromIndex + pageSize)
  }, [filteredAssets, currentPage])

  // Generate signed URLs in real-time
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let isCancelled = false
    const generateUrls = async () => {
      const targetAssets = allowedFilteredAssets.map(asset => {
        if (asset.mime_type === 'application/x-widget-qrcode') {
          try {
            const config = JSON.parse(asset.file_path)
            return { originalPath: asset.file_path, filePathToSign: config.png_path }
          } catch {
            return null
          }
        }
        if ((asset.mime_type.startsWith('image/') || asset.mime_type.startsWith('video/')) && !asset.mime_type.startsWith('application/x-widget')) {
          return { originalPath: asset.file_path, filePathToSign: asset.file_path }
        }
        return null
      }).filter(Boolean) as { originalPath: string, filePathToSign: string }[]

      const promises = targetAssets.map(async (item) => {
        const url = await getCachedSignedUrl(supabase, item.filePathToSign, 3600)
        return { path: item.originalPath, url }
      })
      const results = await Promise.all(promises)
      if (isCancelled) return

      const urls: Record<string, string> = {}
      for (const res of results) {
        if (res.url) {
          urls[res.path] = res.url
        }
      }
      setPreviewUrls(urls)
    }
    generateUrls()
    return () => {
      isCancelled = true
    }
  }, [allowedFilteredAssets, supabase])

  const setViewModeWithStorage = useCallback((mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('assetBrowserViewMode', mode)
  }, [])

  return (
    <AssetBrowserContext.Provider value={{
      allowedMimeTypes,
      isMultiSelect,
      teamSlug,
      teamId,
      supabase,
      onClose,
      onSelect,
      onSelectMultiple,
      folders,
      setFolders,
      activeFolder,
      setActiveFolder,
      isLoadingFiles,
      filesCache,
      setFilesCache,
      loadFolderFiles,
      breadcrumbs,
      searchQuery,
      setSearchQuery,
      selectedType,
      setSelectedType,
      filterDatePreset,
      setFilterDatePreset,
      filterStartDate,
      setFilterStartDate,
      filterEndDate,
      setFilterEndDate,
      filterSizePreset,
      setFilterSizePreset,
      filterMinSize,
      setFilterMinSize,
      filterMaxSize,
      setFilterMaxSize,
      isFilterActive,
      clearFilters,
      viewMode,
      setViewMode: setViewModeWithStorage,
      currentPage,
      setCurrentPage,
      pageSize,
      totalItems,
      totalPages,
      startItem,
      endItem,
      filteredAssets,
      paginatedAssets,
      previewUrls,
      selectedIds,
      toggleSelect,
      clearSelection,
      sortBy,
      setSortBy
    }}>
      {children}
    </AssetBrowserContext.Provider>
  )
}
