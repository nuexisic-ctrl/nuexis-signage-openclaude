import { useEffect } from 'react'
import { X, File } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'

interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  created_at: string
}

interface Props {
  asset: Asset
  previewUrl: string | null
  onClose: () => void
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

export function AssetPreviewModal({ asset, previewUrl, onClose }: Props) {
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const isImg = isImage(asset.mime_type)
  const isVid = isVideo(asset.mime_type)
  const isYouTube = asset.mime_type === 'application/x-widget-youtube'
  const isRemoteUrl = asset.mime_type === 'application/x-widget-remote-url'
  const isHtml = asset.mime_type === 'application/x-widget-html'

  let youtubeVideoId = ''
  if (isYouTube) {
    youtubeVideoId = asset.file_path.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
  }

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className={styles.modalContainer} style={{ maxWidth: '900px', width: '90vw' }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span className={styles.modalTitle} title={asset.file_name}>{asset.file_name}</span>
            <span className={styles.modalMime}>{isYouTube ? 'YouTube Widget' : isRemoteUrl ? 'Remote URL Widget' : isHtml ? 'Text/HTML Widget' : asset.mime_type === 'application/x-widget-flow' ? 'Cloak' : asset.mime_type}</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.modalContent} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', background: '#000', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
          {isImg && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={asset.file_name} className={styles.modalMedia} style={{ maxHeight: '70vh', objectFit: 'contain' }} />
          ) : isVid && previewUrl ? (
            <video src={previewUrl} controls autoPlay className={styles.modalMedia} style={{ maxHeight: '70vh', maxWidth: '100%' }} />
          ) : isYouTube && youtubeVideoId ? (
            <iframe 
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
              style={{ width: '100%', aspectRatio: '16/9', border: 'none', maxHeight: '70vh' }}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          ) : isRemoteUrl ? (
            asset.file_path.match(/\.(mp4|webm)$/i) ? (
              <video src={asset.file_path} controls autoPlay className={styles.modalMedia} style={{ maxHeight: '70vh', maxWidth: '100%' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.file_path} alt={asset.file_name} className={styles.modalMedia} style={{ maxHeight: '70vh', objectFit: 'contain' }} />
            )
          ) : isHtml ? (() => {
            try {
              const { html = '', css = '' } = JSON.parse(asset.file_path)
              const iframeSrcDoc = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <style>
                      body { margin: 0; padding: 0; box-sizing: border-box; overflow: hidden; background: transparent; }
                      ${css}
                    </style>
                  </head>
                  <body>
                    ${html}
                  </body>
                </html>
              `
              return (
                <iframe
                  title="widget-html-preview"
                  srcDoc={iframeSrcDoc}
                  style={{ width: '100%', aspectRatio: '16/9', border: 'none', maxHeight: '70vh', background: 'transparent' }}
                  sandbox="allow-same-origin"
                />
              )
            } catch (err) {
              console.error('Failed to parse HTML widget contents in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering custom HTML widget</div>
            }
          })() : asset.mime_type === 'application/x-widget-flow' ? (() => {
            try {
              const config = JSON.parse(asset.file_path)
              return (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlowClockRenderer
                    style={config.style}
                    showSeconds={config.showSeconds}
                    dateFormat={config.dateFormat}
                  />
                </div>
              )
            } catch (err) {
              console.error('Failed to parse Cloak widget config in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering Cloak</div>
            }
          })() : (
            <div className={styles.modalUnsupported} style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
              <File size={48} className={styles.unsupportedIcon} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <p>Preview not available for this type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
