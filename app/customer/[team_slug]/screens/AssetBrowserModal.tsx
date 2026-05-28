'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, FileText, Video, Image as ImageIcon, Play, MoreVertical, Monitor, Link2 } from 'lucide-react'
import styles from './AssetBrowserModal.module.css'

const YoutubeIcon = ({ size = 20, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)
import { createClient } from '@/lib/supabase/client'
import { Asset } from './types'

export interface AssetBrowserModalProps {
  assets: Asset[]
  onClose: () => void
  onSelect: (assetId: string) => void
}

export function AssetBrowserModal({
  assets,
  onClose,
  onSelect,
}: AssetBrowserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('assetBrowserViewMode')
      if (saved === 'grid' || saved === 'table') return saved
    }
    return 'table'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const supabase = useMemo(() => createClient(), [])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('assetBrowserViewMode', mode)
  }

  // Lock body scroll when modal is open, and handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Generate signed URLs for Images & Videos in real-time
  useEffect(() => {
    let isCancelled = false
    const generateUrls = async () => {
      const targetAssets = assets.filter(
        asset => (asset.mime_type.startsWith('image/') || asset.mime_type.startsWith('video/')) && !asset.mime_type.startsWith('application/x-widget')
      )
      const promises = targetAssets.map(async (asset) => {
        const { data } = await supabase.storage
          .from('workspace-media')
          .createSignedUrl(asset.file_path, 3600)
        return { path: asset.file_path, url: data?.signedUrl || null }
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
  }, [assets, supabase])

  // Formatting helpers
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'May 17, 2026'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'May 17, 2026'
    }
  }

  const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getAssetTypeBadge = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('application/x-widget')) return 'WIDGET'
    if (mimeType.startsWith('video/')) {
      const ext = fileName.split('.').pop()?.toUpperCase()
      return ext || 'VIDEO'
    }
    if (mimeType.startsWith('image/')) {
      const ext = fileName.split('.').pop()?.toUpperCase()
      return ext || 'IMAGE'
    }
    return 'MEDIA'
  }

  // Filter & Search Logic
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = asset.file_name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      if (selectedType === 'all') return true
      if (selectedType === 'widget') return asset.mime_type.startsWith('application/x-widget')
      if (selectedType === 'video') return asset.mime_type.startsWith('video/')
      if (selectedType === 'image') return asset.mime_type.startsWith('image/')
      return true
    })
  }, [assets, searchQuery, selectedType])

  // Pagination Logic
  const totalItems = filteredAssets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const paginatedAssets = useMemo(() => {
    const fromIndex = (currentPage - 1) * pageSize
    return filteredAssets.slice(fromIndex, fromIndex + pageSize)
  }, [filteredAssets, currentPage])

  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    setCurrentPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  // Render Premium thumbnails: uses actual image sources and video first frame preloads!
  const renderCardPreview = (asset: Asset) => {
    const isWidget = asset.mime_type.startsWith('application/x-widget')
    const isVideo = asset.mime_type.startsWith('video/')
    const isImage = asset.mime_type.startsWith('image/')
    const previewUrl = previewUrls[asset.file_path]

    if (isWidget) {
      if (asset.file_name.toLowerCase().includes('kilo') || asset.file_name.toLowerCase().includes('link') || asset.mime_type === 'application/x-widget-remote-url') {
        return (
          <div className={styles.cardPreviewBox} style={{ background: 'var(--surface-low)' }}>
            <Link2 size={36} className={styles.cardPreviewIcon} style={{ color: 'var(--on-surface-muted)' }} />
          </div>
        )
      }
      return (
        <div className={styles.cardPreviewBox} style={{ background: 'var(--surface-low)' }}>
          <YoutubeIcon size={36} className={styles.cardPreviewIcon} style={{ color: 'var(--on-surface-muted)' }} />
        </div>
      )
    }

    if (isImage) {
      if (previewUrl) {
        return (
          <div className={styles.cardPreviewBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={asset.file_name} className={styles.cardThumbnail} />
          </div>
        )
      }
      return (
        <div className={styles.cardPreviewBox}>
          <ImageIcon size={30} className={styles.cardPreviewIcon} />
        </div>
      )
    }

    if (isVideo) {
      if (previewUrl) {
        return (
          <div className={styles.cardPreviewBox}>
            <video src={`${previewUrl}#t=0.001`} className={styles.cardThumbnail} preload="metadata" muted playsInline />
            <div className={styles.videoOverlay}>
              <Play size={28} className={styles.videoIcon} />
            </div>
          </div>
        )
      }
      return (
        <div className={styles.cardPreviewBox}>
          <Play size={28} className={styles.cardPreviewIcon} />
        </div>
      )
    }

    return (
      <div className={styles.cardPreviewBox}>
        <FileText size={30} className={styles.cardPreviewIcon} />
      </div>
    )
  }

  const renderTableIcon = (asset: Asset) => {
    const isWidget = asset.mime_type.startsWith('application/x-widget')
    const isVideo = asset.mime_type.startsWith('video/')
    const isImage = asset.mime_type.startsWith('image/')

    if (isWidget) {
      if (asset.file_name.toLowerCase().includes('kilo') || asset.file_name.toLowerCase().includes('link') || asset.mime_type === 'application/x-widget-remote-url') {
        return <Link2 size={18} />
      }
      return <YoutubeIcon size={18} />
    }
    if (isVideo) return <Video size={18} />
    if (isImage) return <ImageIcon size={18} />
    return <FileText size={18} />
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
              <button 
                className={`${styles.filterToggleBtn} ${showFilters || selectedType !== 'all' ? styles.active : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={14} />
                Filters
              </button>
              
              <div className={styles.viewToggleGroup}>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('table')}
                  title="Table View"
                >
                  <List />
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className={styles.filtersBar}>
              <span className={styles.filterLabel}>Filter by Type:</span>
              <select
                className={styles.filterSelect}
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="all">All Assets</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="widget">Widgets</option>
              </select>
            </div>
          )}
        </div>

        <div className={styles.body}>
          {paginatedAssets.length === 0 ? (
            <div className={styles.emptyState}>
              <h4 className={styles.emptyText}>No assets match your query.</h4>
            </div>
          ) : viewMode === 'table' ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssets.map((asset) => {
                    const badgeType = getAssetTypeBadge(asset.mime_type, asset.file_name)
                    return (
                      <tr
                        key={asset.id}
                        className={styles.row}
                        onClick={() => onSelect(asset.id)}
                      >
                        <td>
                          <div className={styles.fileNameCell}>
                            <div className={styles.fileIconWrapper}>
                              {renderTableIcon(asset)}
                            </div>
                            <span className={styles.fileNameText}>{asset.file_name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.typeBadge}>
                            {badgeType}
                          </span>
                        </td>
                        <td>{formatSize(asset.size_bytes)}</td>
                        <td>{formatDate(asset.created_at)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.actionIconBtn}
                            onClick={() => onSelect(asset.id)}
                            title="Select Asset"
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
                    onClick={() => onSelect(asset.id)}
                  >
                    {renderCardPreview(asset)}
                    <div className={styles.cardBody}>
                      <span className={`${styles.typeBadge} ${styles.cardTypeBadge}`}>
                        {badgeType}
                      </span>
                      <h4 className={styles.cardTitle} title={asset.file_name}>
                        {asset.file_name}
                      </h4>
                      <div className={styles.cardDetails}>
                        <span>{formatSize(asset.size_bytes)} • {formatDate(asset.created_at)}</span>
                      </div>
                      <div className={styles.cardMenuBtn} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={styles.actionIconBtn}
                          onClick={() => onSelect(asset.id)}
                          title="Select Asset"
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
    </div>
  )
}
