'use client'

import { createPortal } from 'react-dom'
import { File, Play, LayoutTemplate, MonitorPlay, Link } from 'lucide-react'
import styles from './AssetCard.module.css'

import { createClient } from '@/lib/supabase/client'
import { Asset, formatBytes, isImage, isVideo, isWidget } from './types'

export function AssetCard({
  asset,
  previewUrl,
  onDelete,
  onPreview,
  onRename,
  isDeleting,
  menuOpen,
  onToggleMenu,
  menuPosition,
}: {
  asset: Asset
  previewUrl: string | null
  onDelete: () => void
  onPreview: (asset: Asset) => void
  onRename: () => void
  isDeleting: boolean
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  menuPosition?: { top: number, right: number } | null
}) {
  const date = new Date(asset.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const supabase = createClient()

  const handleDownload = async () => {
    try {
      const { data } = await supabase.storage
        .from('workspace-media')
        .createSignedUrl(asset.file_path, 60, {
          download: asset.file_name,
        })
      if (data?.signedUrl) {
        window.location.href = data.signedUrl
      }
    } catch (err) {
      console.error('Failed to download asset:', err)
    }
  }

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
        
        <div className={styles.mimeChip}>
          {isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}
        </div>
      </div>

      <div className={styles.assetInfo}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <p className={styles.assetName} title={asset.file_name}>{asset.file_name}</p>
          <div className={styles.moreMenuWrapper}>
            <button 
              className={`${styles.actionBtnBox} ${menuOpen ? styles.active : ''}`}
              onClick={onToggleMenu}
              aria-label="More Actions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>
            {menuOpen && menuPosition && typeof window !== 'undefined' && createPortal(
              <div 
                className={styles.moreDropdown}
                style={{ position: 'absolute', top: menuPosition.top, right: menuPosition.right, zIndex: 100000 }}
                onClick={e => e.stopPropagation()}
              >
                <button className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onPreview(asset); }}>
                  Preview
                </button>
                {!isWidget(asset.mime_type) && (
                  <button className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                    Download
                  </button>
                )}
                <button className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onRename(); }}>
                  Rename
                </button>
                <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                  Delete
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className={styles.assetMeta}>
          <span>{formatBytes(asset.size_bytes)}</span>
          <span className={styles.metaDot}>·</span>
          <span>{date}</span>
        </div>
      </div>
    </div>
  )
}
