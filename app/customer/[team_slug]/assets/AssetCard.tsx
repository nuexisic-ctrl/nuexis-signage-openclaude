'use client'

import { createPortal } from 'react-dom'
import { File, Play, LayoutTemplate, Link, Code, Clock, QrCode, Folder, Hourglass, Globe, Images, FileText, Music, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Asset, ScreenDevice, formatBytes, isImage, isVideo, isWidget } from './types'
import { t } from '@/lib/i18n'
import styles from './AssetCard.module.css'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'

const YoutubeIcon = ({ size = 20, style }: { size?: number; style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={style}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)

export function AssetCard({
  asset,
  previewUrl,
  screens,
  onDelete,
  onPreview,
  onRename,
  onPushToScreen,
  isDeleting,
  menuOpen,
  onToggleMenu,
  menuPosition,
  selected = false,
  onToggleSelect,
  isSelectionActive = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDropTarget = false,
}: {
  asset: Asset
  previewUrl: string | null
  screens?: ScreenDevice[]
  onDelete: () => void
  onPreview: (asset: Asset) => void
  onRename: () => void
  onPushToScreen: () => void
  isDeleting: boolean
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  menuPosition?: { top: number, right: number } | null
  selected?: boolean
  onToggleSelect?: () => void
  isSelectionActive?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  isDropTarget?: boolean
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

  const isFolder = asset.mime_type === 'application/x-folder'

  return (
    <div
      className={`${styles.assetCard} ${isDeleting ? styles.assetCardDeleting : ''} ${selected ? styles.assetCardSelected : ''} ${isDropTarget ? styles.dropTarget : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {onToggleSelect && (
        <div 
          className={`${styles.selectionToggle} ${(isSelectionActive || selected) ? styles.selectionToggleVisible : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          role="button"
          tabIndex={0}
          aria-label={selected ? t('Deselect') : t('Select')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onToggleSelect()
            }
          }}
        >
          <input 
            type="checkbox" 
            checked={selected} 
            readOnly
            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, pointerEvents: 'none' }}
          />
        </div>
      )}
      <div className={`${styles.moreMenuWrapper} ${styles.moreActionsToggle} ${menuOpen ? styles.moreActionsToggleVisible : ''}`}>
        <button 
          className={styles.moreActionsButton}
          onClick={onToggleMenu}
          aria-label="More Actions"
          type="button"
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
            {isWidget(asset.mime_type) && asset.mime_type !== 'application/x-widget-qrcode' ? (
              <button className={styles.dropdownItem} type="button" onClick={(e) => { e.stopPropagation(); onPreview(asset); }}>
                {t('Edit Widget')}
              </button>
            ) : (
              <button className={styles.dropdownItem} type="button" onClick={(e) => { e.stopPropagation(); onPreview(asset); }}>
                {isFolder ? t('Open') : t('Preview')}
              </button>
            )}
            {!isFolder && (
              <button 
                className={styles.dropdownItem} 
                type="button" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onPushToScreen(); 
                }}
              >
                {t('Push to screen')}
              </button>
            )}
            {!isWidget(asset.mime_type) && !isFolder && (
              <button className={styles.dropdownItem} type="button" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                {t('Download')}
              </button>
            )}

            <button className={styles.dropdownItem} type="button" onClick={(e) => { e.stopPropagation(); onRename(); }}>
              {t('Rename')}
            </button>
            <button className={`${styles.dropdownItem} ${styles.danger}`} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              {t('Delete')}
            </button>
          </div>,
          document.body
        )}
      </div>
      <div
        className={`${styles.assetThumb} ${styles.assetThumbInteractive}`}
        onClick={(e) => {
          e.stopPropagation()
          if (isSelectionActive && onToggleSelect) onToggleSelect()
          else onPreview(asset)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            if (isSelectionActive && onToggleSelect) onToggleSelect()
            else onPreview(asset)
          }
        }}
        aria-label={isFolder ? `Open ${asset.file_name}` : `Preview ${asset.file_name}`}
      >
        {isFolder ? (
          <div className={styles.videoThumbWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-low)' }}>
               <Folder size={72} style={{ stroke: asset.color || '#78716c', fill: asset.color || '#78716c', fillOpacity: 0.15 }} />
             </div>
          </div>
        ) : (isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode') && previewUrl ? (
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
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-low)' }}>
                 {asset.mime_type === 'application/x-widget-youtube' || asset.mime_type === 'application/x-widget-youtube-playlist' ? (
                  <YoutubeIcon size={72} style={{ stroke: '#ff0000', color: '#ff0000' }} />
                ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                  <Link size={72} style={{ stroke: '#0ea5e9', color: '#0ea5e9' }} />
                ) : asset.mime_type === 'application/x-widget-html' ? (
                  <Code size={72} style={{ stroke: '#10b981', color: '#10b981' }} />
                ) : asset.mime_type === 'application/x-widget-flow' ? (
                  <Clock size={72} style={{ stroke: '#8b5cf6', color: '#8b5cf6' }} />
                ) : asset.mime_type === 'application/x-widget-worldclock' ? (
                  <Globe size={72} style={{ stroke: '#f43f5e', color: '#f43f5e' }} />
                ) : asset.mime_type === 'application/x-widget-countdown' ? (
                  <Hourglass size={72} style={{ stroke: '#eab308', color: '#eab308' }} />
                ) : asset.mime_type === 'application/x-widget-slideshow' ? (
                  <Images size={72} style={{ stroke: '#ec4899', color: '#ec4899' }} />
                ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                  <QrCode size={72} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                ) : (
                  <LayoutTemplate size={72} style={{ stroke: '#a855f7', color: '#a855f7' }} />
                )}
             </div>
          </div>
        ) : (
          <div className={styles.genericThumb}>
            <File className={styles.genericIcon} size={30} />
          </div>
        )}
      </div>

      <div className={styles.assetInfo}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <p className={styles.assetName}>
            <FilenameTruncator filename={asset.file_name} />
          </p>
        </div>
      </div>
      <div className={styles.assetMeta} style={{ justifyContent: 'space-between', width: '100%', padding: '0 14px 14px', marginTop: '-4px' }}>
          <span>{date}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--on-surface-subtle)' }} title={asset.mime_type}>
            {(() => {
              if (isFolder) return <Folder size={12} style={{ stroke: asset.color || '#78716c' }} />
              if (isImage(asset.mime_type)) return <ImageIcon size={12} style={{ stroke: '#22c55e' }} />
              if (isVideo(asset.mime_type)) return <Play size={12} style={{ stroke: '#3b82f6' }} />
              if (asset.mime_type.startsWith('audio/')) return <Music size={12} style={{ stroke: '#f59e0b' }} />
              if (asset.mime_type === 'application/pdf') return <FileText size={12} style={{ stroke: '#ef4444' }} />
              if (isWidget(asset.mime_type)) return <Code size={12} style={{ stroke: '#a855f7' }} />
              return <File size={12} style={{ stroke: '#64748b' }} />
            })()}
          </span>
        </div>
    </div>
  )
}
