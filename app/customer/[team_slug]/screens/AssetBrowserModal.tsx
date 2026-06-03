'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, FileText, Video, Image as ImageIcon, Play, MoreVertical, Monitor, Link2, Code, Clock, QrCode, Hourglass } from 'lucide-react'
import styles from './AssetBrowserModal.module.css'
import { FilterSidebar } from '../asset/FilterSidebar'
import { modalStack } from '@/lib/utils/modalStack'

const YoutubeIcon = ({ size = 20, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
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
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const supabase = useMemo(() => createClient(), [])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('assetBrowserViewMode', mode)
  }

  // Lock body scroll when modal is open, register with modalStack, and handle Escape key to close
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

  // Generate signed URLs for Images, Videos, and QR Codes in real-time
  useEffect(() => {
    let isCancelled = false
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

  // Derived: whether any filter is active
  const isFilterActive = selectedType !== 'all' || filterDatePreset !== 'all' || filterSizePreset !== 'all'

  const resetFilters = () => {
    setSelectedType('all')
    setFilterDatePreset('all')
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterSizePreset('all')
    setFilterMinSize('')
    setFilterMaxSize('')
    setCurrentPage(1)
  }

  // Filter & Search Logic
  const filteredAssets = useMemo(() => {
    const now = new Date()
    return assets.filter((asset) => {
      // Search
      if (!asset.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false

      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'widget' && !asset.mime_type.startsWith('application/x-widget')) return false
        if (selectedType === 'video' && !asset.mime_type.startsWith('video/')) return false
        if (selectedType === 'image' && !asset.mime_type.startsWith('image/')) return false
      }

      // Date filter
      if (filterDatePreset !== 'all' && asset.created_at) {
        const created = new Date(asset.created_at)
        if (filterDatePreset === 'today') {
          const today = new Date(); today.setHours(0,0,0,0)
          if (created < today) return false
        } else if (filterDatePreset === '7days') {
          const cutoff = new Date(now.getTime() - 7 * 86400000)
          if (created < cutoff) return false
        } else if (filterDatePreset === '30days') {
          const cutoff = new Date(now.getTime() - 30 * 86400000)
          if (created < cutoff) return false
        } else if (filterDatePreset === 'custom') {
          if (filterStartDate && created < new Date(filterStartDate)) return false
          if (filterEndDate && created > new Date(filterEndDate + 'T23:59:59')) return false
        }
      }

      // Size filter
      const bytes = asset.size_bytes ?? 0
      const mb = bytes / (1024 * 1024)
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
  }, [assets, searchQuery, selectedType, filterDatePreset, filterStartDate, filterEndDate, filterSizePreset, filterMinSize, filterMaxSize])

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

    if (asset.mime_type === 'application/x-widget-qrcode' && previewUrl) {
      return (
        <div className={styles.cardPreviewBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={asset.file_name} className={styles.cardThumbnail} />
        </div>
      )
    }

    if (isWidget) {
      return (
        <div className={styles.cardPreviewBox} style={{ background: 'var(--surface-low)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {asset.mime_type === 'application/x-widget-youtube' ? (
            <YoutubeIcon size={72} style={{ stroke: '#ff0000', color: '#ff0000' }} />
          ) : asset.mime_type === 'application/x-widget-remote-url' ? (
            <Link2 size={72} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
          ) : asset.mime_type === 'application/x-widget-html' ? (
            <Code size={72} style={{ stroke: '#10b981', color: '#10b981' }} />
          ) : asset.mime_type === 'application/x-widget-flow' ? (
            <Clock size={72} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
          ) : asset.mime_type === 'application/x-widget-countdown' ? (
            <Hourglass size={72} style={{ stroke: '#eab308', color: '#eab308' }} />
          ) : asset.mime_type === 'application/x-widget-qrcode' ? (
            <QrCode size={72} style={{ stroke: '#a855f7', color: '#a855f7' }} />
          ) : (
            <LayoutGrid size={72} style={{ stroke: '#a855f7', color: '#a855f7' }} />
          )}
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
    const previewUrl = previewUrls[asset.file_path]

    if (asset.mime_type === 'application/x-widget-qrcode' && previewUrl) {
      return <img src={previewUrl} className={styles.tableThumbnail} alt="" />
    }

    if (isWidget) {
      if (asset.mime_type === 'application/x-widget-youtube') {
        return <YoutubeIcon size={18} style={{ stroke: '#ff0000', color: '#ff0000' }} />
      }
      if (asset.mime_type === 'application/x-widget-remote-url') {
        return <Link2 size={18} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
      }
      if (asset.mime_type === 'application/x-widget-html') {
        return <Code size={18} style={{ stroke: '#10b981', color: '#10b981' }} />
      }
      if (asset.mime_type === 'application/x-widget-flow') {
        return <Clock size={18} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
      }
      if (asset.mime_type === 'application/x-widget-countdown') {
        return <Hourglass size={18} style={{ stroke: '#eab308', color: '#eab308' }} />
      }
      if (asset.mime_type === 'application/x-widget-qrcode') {
        return <QrCode size={18} style={{ stroke: '#a855f7', color: '#a855f7' }} />
      }
      return <LayoutGrid size={18} style={{ stroke: '#a855f7', color: '#a855f7' }} />
    }
    if (isImage) {
      if (previewUrl) {
        return <img src={previewUrl} className={styles.tableThumbnail} alt="" />
      }
      return <ImageIcon size={18} />
    }
    if (isVideo) {
      if (previewUrl) {
        return <video src={`${previewUrl}#t=0.001`} className={styles.tableThumbnail} preload="metadata" muted playsInline />
      }
      return <Video size={18} />
    }
    return <FileText size={18} />
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
        </div>

        <div className={`${styles.body} ${showFilters ? styles.bodyWithSidebar : ''}`}>
          <div className={styles.bodyMain}>
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
    </div>
  )
}
