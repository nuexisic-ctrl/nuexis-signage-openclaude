'use client'

import { useState, useTransition } from 'react'
import { Folder, X, Play, Image as ImageIcon, File, QrCode, Link, Code, Clock, ArrowUpLeft, Eye, Trash2, Edit2, AlertTriangle, Hourglass, Globe } from 'lucide-react'
import { Asset, formatBytes, isImage, isVideo, isWidget } from './types'
import { moveAssetsToFolder } from './actions'
import { t } from '@/lib/i18n'
import styles from './Modal.module.css'

const YoutubeIcon = ({ size = 18, style }: { size?: number; style?: React.CSSProperties }) => (
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

export function FolderContentsModal({
  folder,
  assets,
  teamSlug,
  onClose,
  onPreviewAsset,
  onRenameAsset,
  onDeleteAsset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPreviewUrl: _getPreviewUrl,
  onRefresh,
}: {
  folder: Asset
  assets: Asset[]
  teamSlug: string
  onClose: () => void
  onPreviewAsset: (asset: Asset) => void
  onRenameAsset: (asset: Asset) => void
  onDeleteAsset: (asset: Asset) => void
  getPreviewUrl: (filePath: string) => string | null
  onRefresh: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const folderAssets = assets.filter(a => a.folder_id === folder.id)

  const handleMoveOut = (assetId: string) => {
    startTransition(async () => {
      const result = await moveAssetsToFolder(teamSlug, [assetId], null)
      if (result.success) {
        onRefresh()
      } else {
        setError(result.error || t('Failed to move asset out of folder.'))
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContainer} 
        style={{ padding: '0', maxWidth: '640px', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '600px' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--outline-variant)', background: 'rgba(7, 17, 31, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Folder size={24} style={{ stroke: folder.color || '#78716c', fill: folder.color || '#78716c', fillOpacity: 0.15 }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
                {folder.file_name}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', fontWeight: 600 }}>
                {folderAssets.length} {folderAssets.length === 1 ? t('asset') : t('assets')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={20} /></button>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" style={{ margin: '16px 24px 0' }}>
            <AlertTriangle className={styles.errorIcon} size={17} />
            {error}
          </div>
        )}

        {/* Content list / Empty state */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {folderAssets.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--on-surface-muted)', textAlign: 'center', padding: '48px 0' }}>
              <Folder size={48} style={{ stroke: 'var(--on-surface-muted)', opacity: 0.4 }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--on-surface)', fontWeight: 700 }}>
                {t('This folder is empty')}
              </h3>
              <p style={{ margin: 0, fontSize: '0.86rem', maxWidth: '320px', lineHeight: '1.5' }}>
                {t("Go back to the library, select some files, and click the 'Move' button to add assets to this folder.")}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {folderAssets.map((asset) => {
                return (
                  <div 
                    key={asset.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '10px 14px', 
                      background: 'var(--surface-low)', 
                      border: '1px solid var(--outline-variant)', 
                      borderRadius: '8px',
                      gap: '12px'
                    }}
                  >
                    {/* Thumbnail and Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '6px', 
                          background: 'var(--surface-lowest)', 
                          border: '1px solid var(--outline-variant)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}
                      >
                        {isImage(asset.mime_type) ? (
                          <ImageIcon size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : isVideo(asset.mime_type) ? (
                          <Play size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-youtube' ? (
                          <YoutubeIcon size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-remote-url' ? (
                          <Link size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-html' ? (
                          <Code size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-flow' ? (
                          <Clock size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-worldclock' ? (
                          <Globe size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-countdown' ? (
                          <Hourglass size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : asset.mime_type === 'application/x-widget-qrcode' ? (
                          <QrCode size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        ) : (
                          <File size={18} style={{ stroke: 'var(--on-surface-subtle)' }} />
                        )}
                      </div>
                      
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.file_name}>
                          {asset.file_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-subtle)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span>{formatBytes(asset.size_bytes)}</span>
                          <span>•</span>
                          <span>{asset.mime_type === 'application/x-widget-flow' ? 'CLOCK' : asset.mime_type === 'application/x-widget-worldclock' ? 'WORLD CLOCK' : asset.mime_type === 'application/x-widget-countdown' ? 'COUNTDOWN' : isWidget(asset.mime_type) ? 'WIDGET' : (asset.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onPreviewAsset(asset)}
                        title={t('Preview')}
                        style={{
                          background: 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                          color: 'var(--on-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-lowest)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRenameAsset(asset)}
                        title={t('Rename')}
                        style={{
                          background: 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                          color: 'var(--on-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-lowest)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMoveOut(asset.id)}
                        title={t('Move out of folder')}
                        style={{
                          background: 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: isPending ? 'not-allowed' : 'pointer',
                          color: 'var(--on-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-lowest)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <ArrowUpLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAsset(asset)}
                        title={t('Delete')}
                        style={{
                          background: 'transparent', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                          color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-lowest)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
