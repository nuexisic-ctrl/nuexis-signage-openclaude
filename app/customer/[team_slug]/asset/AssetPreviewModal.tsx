import { useEffect } from 'react'
import { X, File } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import { useA11yModal } from '@/lib/utils/useA11yModal'

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
  const dialogRef = useA11yModal({
    id: 'asset-preview-modal',
    onClose,
    initialFocusSelector: 'button[data-modal-close="true"]',
  })

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const isImg = isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode'
  const isVid = isVideo(asset.mime_type)
  const isYouTube = asset.mime_type === 'application/x-widget-youtube'
  const isRemoteUrl = asset.mime_type === 'application/x-widget-remote-url'
  const isHtml = asset.mime_type === 'application/x-widget-html'

  let youtubeVideoId = ''
  if (isYouTube) {
    youtubeVideoId = asset.file_path.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
  }

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick} role="presentation">
      <div
        ref={dialogRef as any}
        className={styles.modalContainer}
        style={{ maxWidth: '900px', width: '90vw' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-preview-title"
        aria-describedby="asset-preview-type"
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span id="asset-preview-title" className={styles.modalTitle} title={asset.file_name}>{asset.file_name}</span>
            <span id="asset-preview-type" className={styles.modalMime}>
              {isYouTube
                ? 'YouTube Widget'
                : isRemoteUrl
                  ? 'Remote URL Widget'
                  : isHtml
                    ? 'Text/HTML Widget'
                    : asset.mime_type === 'application/x-widget-flow'
                      ? 'Clock Widget'
                      : asset.mime_type === 'application/x-widget-countdown'
                        ? 'Countdown Widget'
                        : asset.mime_type === 'application/x-widget-countup'
                          ? 'CountUp Widget'
                        : asset.mime_type === 'application/x-widget-qrcode'
                          ? 'QR Code Widget'
                          : asset.mime_type}
            </span>
          </div>
          <button
            data-modal-close="true"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close preview"
            type="button"
          >
            <X size={24} />
          </button>
        </div>
        
        <div
          className={styles.modalContent}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '300px',
            background: '#000',
            borderRadius: '0 0 16px 16px',
            overflow: 'hidden',
          }}
        >
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
                  sandbox=""
                />
              )
            } catch (err) {
              console.error('Failed to parse HTML widget contents in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering custom HTML widget</div>
            }
          })() : asset.mime_type === 'application/x-widget-countdown' ? (() => {
            try {
              const config = JSON.parse(asset.file_path)
              return (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlowCountdownRenderer
                    text={config.text}
                    endTime={config.endTime}
                    endMessage={config.endMessage}
                    timerStyle={config.timerStyle}
                    daysOnly={config.daysOnly}
                    theme={config.theme}
                    themeSettings={config.themeSettings}
                    advancedSettings={config.advancedSettings}
                  />
                </div>
              )
            } catch (err) {
              console.error('Failed to parse Countdown widget config in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering Countdown widget</div>
            }
          })() : asset.mime_type === 'application/x-widget-countup' ? (() => {
            try {
              const config = JSON.parse(asset.file_path)
              return (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlowCountUpRenderer
                    text={config.text}
                    startTime={config.startTime}
                    endTime={config.endTime}
                    endMessage={config.endMessage}
                    timerStyle={config.timerStyle}
                    daysOnly={config.daysOnly}
                    theme={config.theme}
                    themeSettings={config.themeSettings}
                    advancedSettings={config.advancedSettings}
                  />
                </div>
              )
            } catch (err) {
              console.error('Failed to parse CountUp widget config in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering CountUp widget</div>
            }
          })() : asset.mime_type === 'application/x-widget-flow' ? (() => {
            try {
              const config = JSON.parse(asset.file_path)
              return (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlowClockRenderer
                    style={config.style}
                    showSeconds={config.showSeconds}
                    showDate={config.showDate}
                    use24Hour={config.use24Hour}
                    dateFormat={config.dateFormat}
                  />
                </div>
              )
            } catch (err) {
              console.error('Failed to parse Clock widget config in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering Clock widget</div>
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
