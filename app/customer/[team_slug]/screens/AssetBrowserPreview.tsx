'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Folder, FileText, Video, Image as ImageIcon, Play, LayoutGrid, List, Code, Clock, Hourglass, QrCode, Globe } from 'lucide-react'
import { Asset } from '../asset/types'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import styles from './AssetBrowserModal.module.css'

export const YoutubeIcon = ({ size = 20, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)

export const formatDate = (dateStr?: string) => {
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

export const formatSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const getAssetTypeBadge = (mimeType: string, fileName: string) => {
  if (mimeType === 'application/x-folder') return 'FOLDER'
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

interface CardPreviewProps {
  asset: Asset
  previewUrls: Record<string, string>
}

export function CardPreview({ asset, previewUrls }: CardPreviewProps) {
  if (asset.mime_type === 'application/x-folder') {
    return (
      <div className={styles.cardPreviewBox} style={{ background: 'var(--surface-low)' }}>
        <Folder size={64} style={{ stroke: asset.color || '#78716c', fill: asset.color || '#78716c', fillOpacity: 0.15 }} />
      </div>
    )
  }

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
        ) : asset.mime_type === 'application/x-widget-youtube-playlist' ? (
          <List size={72} style={{ stroke: '#ff4444', color: '#ff4444' }} />
        ) : asset.mime_type === 'application/x-widget-remote-url' ? (
          <FileText size={72} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
        ) : asset.mime_type === 'application/x-widget-html' ? (
          <Code size={72} style={{ stroke: '#10b981', color: '#10b981' }} />
        ) : asset.mime_type === 'application/x-widget-flow' ? (
          <Clock size={72} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
        ) : asset.mime_type === 'application/x-widget-worldclock' ? (
          <Globe size={72} style={{ stroke: '#f43f5e', color: '#f43f5e' }} />
        ) : asset.mime_type === 'application/x-widget-countdown' ? (
          <Hourglass size={72} style={{ stroke: '#eab308', color: '#eab308' }} />
        ) : asset.mime_type === 'application/x-widget-countup' ? (
          <Hourglass size={72} style={{ stroke: '#22c55e', color: '#22c55e' }} />
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

interface TableIconProps {
  asset: Asset
  previewUrls: Record<string, string>
}

export function TableIcon({ asset, previewUrls }: TableIconProps) {
  if (asset.mime_type === 'application/x-folder') {
    return <Folder size={18} style={{ stroke: asset.color || '#78716c', fill: asset.color || '#78716c', fillOpacity: 0.15 }} />
  }

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
    if (asset.mime_type === 'application/x-widget-youtube-playlist') {
      return <List size={18} style={{ stroke: '#ff4444', color: '#ff4444' }} />
    }
    if (asset.mime_type === 'application/x-widget-remote-url') {
      return <FileText size={18} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
    }
    if (asset.mime_type === 'application/x-widget-html') {
      return <Code size={18} style={{ stroke: '#10b981', color: '#10b981' }} />
    }
    if (asset.mime_type === 'application/x-widget-flow') {
      return <Clock size={18} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
    }
    if (asset.mime_type === 'application/x-widget-worldclock') {
      return <Globe size={18} style={{ stroke: '#f43f5e', color: '#f43f5e' }} />
    }
    if (asset.mime_type === 'application/x-widget-countdown') {
      return <Hourglass size={18} style={{ stroke: '#eab308', color: '#eab308' }} />
    }
    if (asset.mime_type === 'application/x-widget-countup') {
      return <Hourglass size={18} style={{ stroke: '#22c55e', color: '#22c55e' }} />
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

export function useFilteredAssets(allLoadedAssets: Asset[], activeFolder: Asset | null) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [filterDatePreset, setFilterDatePreset] = useState('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [filterSizePreset, setFilterSizePreset] = useState('all')
  const [filterMinSize, setFilterMinSize] = useState('')
  const [filterMaxSize, setFilterMaxSize] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const isFilterActive = selectedType !== 'all' || filterDatePreset !== 'all' || filterSizePreset !== 'all'

  const filteredAssets = useMemo(() => {
    const now = new Date()
    const today = new Date().setHours(0,0,0,0)

    const filtered = allLoadedAssets.filter((asset) => {
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
        if (selectedType === 'widget' && !asset.mime_type.startsWith('application/x-widget')) return false
        if (selectedType === 'video' && !asset.mime_type.startsWith('video/')) return false
        if (selectedType === 'image' && !asset.mime_type.startsWith('image/')) return false
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

    // Sort folders at the top, then by created_at descending
    return filtered.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/x-folder'
      const bIsFolder = b.mime_type === 'application/x-folder'
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    })
  }, [allLoadedAssets, searchQuery, selectedType, filterDatePreset, filterStartDate, filterEndDate, filterSizePreset, filterMinSize, filterMaxSize, activeFolder])

  return {
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
  }
}

export function getBreadcrumbs(activeFolder: Asset | null, folders: Asset[]) {
  const list: { name: string; folder: Asset | null }[] = [
    { name: 'Root', folder: null }
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

  for (const f of pathSegments) {
    list.push({
      name: f.file_name,
      folder: f
    })
  }
  return list
}

export function useAssetPreviewUrls(allLoadedAssets: Asset[], supabase: any) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let isCancelled = false
    const generateUrls = async () => {
      const targetAssets = allLoadedAssets.map(asset => {
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
  }, [allLoadedAssets, supabase])

  return previewUrls
}

export function useDragAndDrop(handleFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
