'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { insertAsset, deleteAsset } from './actions'
import styles from './content.module.css'

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

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  previewUrl,
  onDelete,
  isDeleting,
}: {
  asset: Asset
  previewUrl: string | null
  onDelete: (id: string, path: string) => void
  isDeleting: boolean
}) {
  const date = new Date(asset.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className={`${styles.assetCard} ${isDeleting ? styles.assetCardDeleting : ''}`}>
      <div className={styles.assetThumb}>
        {isImage(asset.mime_type) && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={asset.file_name} className={styles.assetImg} />
        ) : isVideo(asset.mime_type) ? (
          <div className={styles.videoThumb}>
            <span className={styles.videoIcon}>▶</span>
          </div>
        ) : (
          <div className={styles.genericThumb}>
            <span className={styles.genericIcon}>◈</span>
          </div>
        )}
        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(asset.id, asset.file_path)}
          disabled={isDeleting}
          aria-label={`Delete ${asset.file_name}`}
          title="Delete asset"
        >
          ✕
        </button>
        <div className={styles.mimeChip}>
          {asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE'}
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

export default function ContentClient({ initialAssets, teamId, teamSlug }: Props) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  // Generate signed URLs for image previews
  const fetchPreviewUrl = useCallback(async (filePath: string, assetId: string) => {
    if (previewUrls[assetId]) return
    const { data } = await supabase.storage
      .from('workspace-media')
      .createSignedUrl(filePath, 60 * 60) // 1 hour
    if (data?.signedUrl) {
      setPreviewUrls(prev => ({ ...prev, [assetId]: data.signedUrl }))
    }
  }, [supabase, previewUrls])

  // Fetch preview URLs for all image assets on mount
  useState(() => {
    initialAssets.forEach((asset) => {
      if (isImage(asset.mime_type)) {
        fetchPreviewUrl(asset.file_path, asset.id)
      }
    })
  })

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
        const ext = file.name.split('.').pop()
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const filePath = `${teamId}/${uniqueName}`

        const { error: storageError } = await supabase.storage
          .from('workspace-media')
          .upload(filePath, file, {
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

          // Pre-fetch preview URL for images
          if (isImage(file.type)) {
            fetchPreviewUrl(filePath, result.id)
          }
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
  }, [teamId, teamSlug, supabase, fetchPreviewUrl, router])

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
      setPreviewUrls(prev => {
        const next = { ...prev }
        delete next[assetId]
        return next
      })
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(assetId)
        return next
      })
    }
  }, [teamSlug])

  return (
    <div className={styles.contentArea}>
      <UploadZone
        onFiles={handleFiles}
        isUploading={isUploading}
        progress={uploadProgress}
      />

      {uploadError && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorIcon}>⚠</span>
          {uploadError}
        </div>
      )}

      {showSuccess && (
        <div className={styles.successBanner} role="alert" style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
          background: 'rgba(22, 163, 74, 0.08)', borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem', color: '#16a34a', fontFamily: 'var(--font-label)',
          marginBottom: '16px'
        }}>
          <span className={styles.successIcon}>✓</span>
          Media successfully uploaded. Ready to be assigned in the Screens page!
        </div>
      )}

      {assets.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>◈</div>
          <h3 className={styles.emptyTitle}>No assets yet</h3>
          <p className={styles.emptyText}>
            Upload images or videos above to start building your content library.
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
              // Eagerly fetch preview for any asset missing a URL
              if (isImage(asset.mime_type) && !previewUrls[asset.id]) {
                fetchPreviewUrl(asset.file_path, asset.id)
              }
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  previewUrl={previewUrls[asset.id] ?? null}
                  onDelete={handleDelete}
                  isDeleting={deletingIds.has(asset.id)}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
