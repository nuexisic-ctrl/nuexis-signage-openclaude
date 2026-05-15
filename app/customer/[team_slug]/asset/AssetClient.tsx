'use client'

import { useState, useCallback, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, File, Play, X, LayoutTemplate, Plus, MonitorPlay, Image as ImageIcon, Link } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUploadUrl, insertAsset, deleteAsset, updateAssetName } from './actions'
import { AssetPreviewModal } from './AssetPreviewModal'
import styles from './asset.module.css'

interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  created_at: string
}

interface Props {
  initialAssets: Asset[]
  teamId: string
  teamSlug: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

function isWidget(mimeType: string) {
  return mimeType.startsWith('application/x-widget')
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function WidgetSelectionModal({
  onClose,
  onSelectYouTube,
  onSelectRemoteUrl
}: {
  onClose: () => void
  onSelectYouTube: () => void
  onSelectRemoteUrl: () => void
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Select Widget</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <button 
            onClick={() => { onClose(); onSelectYouTube(); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
              background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
              color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'var(--font-label)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
          >
            <MonitorPlay color="#ff0000" size={28} />
            YouTube Player
          </button>
          <button 
            onClick={() => { onClose(); onSelectRemoteUrl(); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
              background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
              color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'var(--font-label)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
          >
            <Link color="#4dabf7" size={28} />
            Remote URL
          </button>
        </div>
      </div>
    </div>
  )
}

function YouTubeWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Configure YouTube Widget</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(name, url); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Widget Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lobby YouTube Video"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>YouTube URL</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Widget'}
          </button>
        </form>
      </div>
    </div>
  )
}

function RemoteUrlWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function validateAndSubmit() {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        setError('URL must use HTTPS protocol')
        return
      }
      const pathname = parsed.pathname.toLowerCase()
      if (!/\.(mp4|webm|jpg|jpeg|png)$/.test(pathname)) {
        setError('URL must end with .mp4, .webm, .jpg, .jpeg, or .png')
        return
      }
      setError(null)
      onSubmit(name, url)
    } catch {
      setError('Invalid URL')
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Configure Remote URL</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); validateAndSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className={styles.errorBanner} role="alert" style={{ marginBottom: '0' }}>
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Widget Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Remote Lobby Image"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Media URL (HTTPS only)</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); }}
              placeholder="https://example.com/image.jpg"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Widget'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  previewUrl,
  onDelete,
  onPreview,
  onRename,
  isDeleting,
}: {
  asset: Asset
  previewUrl: string | null
  onDelete: (id: string, path: string) => void
  onPreview: (asset: Asset) => void
  onRename: (asset: Asset) => void
  isDeleting: boolean
}) {
  const date = new Date(asset.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className={`${styles.assetCard} ${isDeleting ? styles.assetCardDeleting : ''}`}>
      <div 
        className={`${styles.assetThumb} ${styles.assetThumbInteractive}`}
        onClick={() => onPreview(asset)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPreview(asset) }}
        aria-label={`Preview ${asset.file_name}`}
      >
        {isImage(asset.mime_type) && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={asset.file_name} className={styles.assetImg} />
        ) : isVideo(asset.mime_type) && previewUrl ? (
          <div className={styles.videoThumbWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video 
              src={`${previewUrl}#t=0.001`} 
              className={styles.assetImg} 
              preload="metadata" 
              muted 
              playsInline 
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
            <div className={styles.videoOverlay}>
              <Play className={styles.videoIcon} size={28} />
            </div>
          </div>
        ) : isWidget(asset.mime_type) ? (
          <div className={styles.videoThumbWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3f0a0a, #0f172a)' }}>
               {asset.mime_type === 'application/x-widget-youtube' ? (
                 <MonitorPlay color="#ff0000" size={48} />
               ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                 <Link color="#4dabf7" size={48} />
               ) : (
                 <LayoutTemplate color="#ffffff" size={48} />
               )}
             </div>
          </div>
        ) : (
          <div className={styles.genericThumb}>
            <File className={styles.genericIcon} size={30} />
          </div>
        )}
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(asset.id, asset.file_path); }}
          disabled={isDeleting}
          aria-label={`Delete ${asset.file_name}`}
          title="Delete asset"
        >
          <X size={15} />
        </button>
        <div className={styles.mimeChip}>
          {isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
        </div>
        <div className={styles.moreMenuWrapper} style={{ position: 'absolute', top: '8px', left: '40px' }}>
          <button
            className={styles.actionBtnBox}
            onClick={(e) => { e.stopPropagation(); onRename(asset); }}
            aria-label={`Rename ${asset.file_name}`}
            title="Rename asset"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.assetInfo}>
        <p className={styles.assetName} title={asset.file_name}>{asset.file_name}</p>
        <div className={styles.assetMeta}>
          <span>{formatBytes(asset.size_bytes)}</span>
          <span className={styles.metaDot}>·</span>
          <span>{date}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({
  onFiles,
  isUploading,
  progress,
}: {
  onFiles: (files: File[]) => void
  isUploading: boolean
  progress: number
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }, [onFiles])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFiles(files)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''} ${isUploading ? styles.dropzoneUploading : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={!isUploading ? handleClick : undefined}
      role="button"
      tabIndex={0}
      aria-label="Upload media files"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime"
        multiple
        className={styles.hiddenInput}
        onChange={handleChange}
        id="media-file-input"
      />

      <div className={styles.dropzoneInner}>
        {isUploading ? (
          <>
            <div className={styles.uploadingIcon}>
              <div className={styles.uploadSpinner} />
            </div>
            <p className={styles.dropzoneTitle}>Uploading…</p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.dropzoneHint}>{progress}% complete</p>
          </>
        ) : (
          <>
            <div className={styles.dropzoneIcon} aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className={styles.dropzoneTitle}>
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className={styles.dropzoneSubtitle}>or click to browse</p>
            <p className={styles.dropzoneHint}>
              Supports JPEG, PNG, GIF, WebP, SVG, MP4, WebM · Max 100 MB per file
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function AssetClient({ initialAssets, teamId, teamSlug }: Props) {
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
  
  // UX Features States
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Generate public URLs for image previews
  const getPreviewUrl = useCallback((filePath: string) => {
    const { data } = supabase.storage
      .from('workspace-media')
      .getPublicUrl(filePath)
    return data.publicUrl
  }, [supabase])

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
        const uploadUrlResult = await getUploadUrl(teamSlug, file.name)
        
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

        // Sync metadata to the DB via server action
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

          // We no longer need to pre-fetch preview URL since it's synchronous now
        }
      } catch (err) {
        console.error('[upload] unexpected error:', err)
        setUploadError(`Unexpected error uploading "${file.name}".`)
      }

      completed += 1
      setUploadProgress(Math.round((completed / total) * 100))
    }

    // Prepend new assets to the list (newest first)
    setAssets(prev => [...newAssets.reverse(), ...prev])
    setIsUploading(false)
    setUploadProgress(0)

    if (newAssets.length > 0) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    }

    // Trigger a server-side revalidation
    startTransition(() => {
      router.refresh()
    })
  }, [teamId, teamSlug, supabase, router])

  const handleDelete = useCallback(async (assetId: string, filePath: string) => {
    setDeletingIds(prev => new Set(prev).add(assetId))
    setUploadError(null)

    const result = await deleteAsset(teamSlug, assetId, filePath)

    if (!result.success) {
      setUploadError(result.error)
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(assetId)
        return next
      })
    } else {
      setAssets(prev => prev.filter(a => a.id !== assetId))
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(assetId)
        return next
      })
    }
  }, [teamSlug])

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

  const handleRenameAssetSuccess = (newName: string) => {
    setAssets(prev => prev.map(a => a.id === renameModalAsset?.id ? { ...a, file_name: newName } : a))
    setRenameModalAsset(null)
  }

  const filteredAssets = assets.filter(a => {
    // 1. Type Filter
    if (filterType !== 'all') {
      if (filterType === 'image' && !isImage(a.mime_type)) return false
      if (filterType === 'video' && !isVideo(a.mime_type)) return false
      if (filterType === 'widget' && !isWidget(a.mime_type)) return false
    }

    // 2. Date Filter
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

    // 3. Search Query
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return a.file_name.toLowerCase().includes(q)
  })

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
              <>
                <div className={styles.gridHeader} style={{ padding: '16px 16px 0' }}>
                  <p className={styles.gridCount}>
                    {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
                  </p>
                </div>
                <div className={styles.grid}>
                  {filteredAssets.map((asset) => {
                    return (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        previewUrl={isImage(asset.mime_type) || isVideo(asset.mime_type) ? getPreviewUrl(asset.file_path) : null}
                        onDelete={handleDelete}
                        onPreview={setPreviewAsset}
                        onRename={setRenameModalAsset}
                        isDeleting={deletingIds.has(asset.id)}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.screensTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th>File Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Date Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map(asset => {
                      const isMenuOpen = openMenuId === asset.id
                      const date = new Date(asset.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })

                    return (
                        <tr key={asset.id} className={styles.tableRow}>
                          <td className={styles.tableCell} onClick={() => setPreviewAsset(asset)} style={{ cursor: 'pointer' }}>
                            <div className={styles.nameCellContent}>
                              <div className={styles.deviceIconWrapper}>
                                {isImage(asset.mime_type) ? <ImageIcon size={20} /> : isVideo(asset.mime_type) ? <Play size={20} /> : <File size={20} />}
                              </div>
                              <div className={styles.cellName}>{asset.file_name}</div>
                            </div>
                          </td>
                          <td className={styles.tableCell}>
                            <div className={styles.mimeChip} style={{ position: 'relative', bottom: 'auto', left: 'auto', display: 'inline-block' }}>
                              {isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
                            </div>
                          </td>
                          <td className={styles.tableCell} style={{ fontSize: '0.88rem', color: 'var(--on-surface)' }}>
                            {formatBytes(asset.size_bytes)}
                          </td>
                          <td className={styles.tableCell}>
                            <div className={styles.cellLastSeen}>
                              {date}
                            </div>
                          </td>
                          <td className={styles.tableCell}>
                            <div className={styles.actionsGroup}>
                              <div className={styles.moreMenuWrapper}>
                                <button 
                                  className={`${styles.actionBtnBox} ${isMenuOpen ? styles.active : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isMenuOpen) {
                                      setOpenMenuId(null);
                                      setMenuPosition(null);
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setMenuPosition({ top: rect.bottom + window.scrollY + 6, right: window.innerWidth - rect.right });
                                      setOpenMenuId(asset.id);
                                    }
                                  }}
                                  disabled={deletingIds.has(asset.id)}
                                  aria-label="More Actions"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <circle cx="12" cy="12" r="1.5"></circle>
                                    <circle cx="12" cy="5" r="1.5"></circle>
                                    <circle cx="12" cy="19" r="1.5"></circle>
                                  </svg>
                                </button>
                                {isMenuOpen && menuPosition && typeof window !== 'undefined' && createPortal(
                                  <div 
                                    className={styles.moreDropdown}
                                    style={{ position: 'absolute', top: menuPosition.top, right: menuPosition.right, zIndex: 1000 }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button className={styles.dropdownItem} onClick={() => {
                                      setOpenMenuId(null);
                                      setRenameModalAsset(asset);
                                    }}>
                                      Rename
                                    </button>
                                    <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={() => {
                                      setOpenMenuId(null);
                                      handleDelete(asset.id, asset.file_path);
                                    }}>
                                      Delete Asset
                                    </button>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Filter Sidebar */}
        {isFilterSidebarOpen && (
          <>
            <div className={styles.sidebarOverlay} onClick={() => setIsFilterSidebarOpen(false)} />
            <aside className={styles.filterSidebar}>
              <div className={styles.sidebarHeader}>
                <h3 className={styles.sidebarTitle}>Advanced Filters</h3>
                <button className={styles.closeSidebarBtn} onClick={() => setIsFilterSidebarOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.sidebarBody}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>File Type</label>
                  <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="widget">Widgets</option>
                  </select>
                </div>
                
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Date Added</label>
                  <select className={styles.filterSelect} value={filterDatePreset} onChange={e => setFilterDatePreset(e.target.value)}>
                    <option value="all">Any time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {filterDatePreset === 'custom' && (
                  <>
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Added After</label>
                      <input type="date" className={styles.filterInput} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Added Before</label>
                      <input type="date" className={styles.filterInput} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className={styles.sidebarFooter}>
                <button 
                  className={styles.resetFiltersBtn} 
                  onClick={() => {
                    setFilterType('all'); 
                    setFilterDatePreset('all');
                    setFilterStartDate(''); 
                    setFilterEndDate('');
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            </aside>
          </>
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
    </div>
  )
}

function RenameAssetModal({
  currentName,
  teamSlug,
  assetId,
  onClose,
  onSuccess,
}: {
  currentName: string
  teamSlug: string
  assetId: string
  onClose: () => void
  onSuccess: (newName: string) => void
}) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name cannot be empty.')
      return
    }
    if (trimmed === currentName) {
      onClose()
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateAssetName(teamSlug, assetId, trimmed)
      if (result.success) {
        onSuccess(trimmed)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Rename Asset</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Asset Name</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lobby Image, Promo Video"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
              autoFocus
            />
          </div>
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '10px 16px', background: 'var(--surface-low)', color: 'var(--on-surface)',
                border: '1px solid var(--outline-variant)', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || name.trim() === currentName}
              style={{
                padding: '10px 16px', background: 'var(--primary)', color: 'var(--on-primary)',
                border: 'none', borderRadius: '8px', cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
