'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, File, Play, X, LayoutTemplate, Plus, MonitorPlay } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUploadUrl, insertAsset, deleteAsset } from './actions'
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
  onSelectYouTube
}: {
  onClose: () => void
  onSelectYouTube: () => void
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

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  previewUrl,
  onDelete,
  onPreview,
  isDeleting,
}: {
  asset: Asset
  previewUrl: string | null
  onDelete: (id: string, path: string) => void
  onPreview: (asset: Asset) => void
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
  const [isSubmittingWidget, setIsSubmittingWidget] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

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

      {assets.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><File size={28} /></div>
          <h3 className={styles.emptyTitle}>No assets yet</h3>
          <p className={styles.emptyText}>
            Upload images or videos above to start building your asset library.
            Your media will be displayed on your paired screens.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.gridHeader}>
            <p className={styles.gridCount}>
              {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
            </p>
          </div>
          <div className={styles.grid}>
            {assets.map((asset) => {
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  previewUrl={isImage(asset.mime_type) || isVideo(asset.mime_type) ? getPreviewUrl(asset.file_path) : null}
                  onDelete={handleDelete}
                  onPreview={setPreviewAsset}
                  isDeleting={deletingIds.has(asset.id)}
                />
              )
            })}
          </div>
        </>
      )}

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
        />
      )}

      {showYouTubeConfig && (
        <YouTubeWidgetModal 
          onClose={() => setShowYouTubeConfig(false)}
          onSubmit={handleCreateYouTubeWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}
    </div>
  )
}
