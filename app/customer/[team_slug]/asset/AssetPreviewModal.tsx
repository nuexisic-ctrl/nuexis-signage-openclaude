import { useState, useEffect } from 'react'
import { X, File } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'
import FlowSlideshowRenderer, { SlideshowImage } from '@/app/components/FlowSlideshowRenderer'
import { useA11yModal } from '@/lib/utils/useA11yModal'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'

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

function SlideshowPreview({ filePath }: { filePath: string }) {
  const [images, setImages] = useState<SlideshowImage[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let isCancelled = false
    const loadAndResolve = async () => {
      try {
        const config = JSON.parse(filePath)
        const rawImages = (config.images || []) as SlideshowImage[]
        const resolved = await Promise.all(
          rawImages.map(async (img) => {
            try {
              const url = await getCachedSignedUrl(supabase, img.file_path, 3600)
              return { ...img, url: url || undefined }
            } catch {
              return img
            }
          })
        )
        if (!isCancelled) {
          setImages(resolved)
        }
      } catch (err) {
        console.error('Failed to resolve preview slideshow config:', err)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }
    loadAndResolve()
    return () => {
      isCancelled = true
    }
  }, [filePath, supabase])

  if (loading) {
    return (
      <div style={{ color: '#aaa', padding: '40px', textAlign: 'center' }}>
        Resolving slideshow images…
      </div>
    )
  }

  let config: { images?: { file_path: string }[]; animation?: "fade" | "slide-left" | "slide-right" | "zoom-in" | "zoom-out"; backgroundColor?: string; duration?: number } | null = null
  try {
    config = JSON.parse(filePath)
  } catch {
    return <div style={{ color: 'red', padding: '20px' }}>Error rendering Slideshow widget</div>
  }

  if (!config) {
    return <div style={{ color: 'red', padding: '20px' }}>Error rendering Slideshow widget</div>
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FlowSlideshowRenderer
        images={images}
        animation={config.animation}
        backgroundColor={config.backgroundColor}
        duration={config.duration}
      />
    </div>
  )
}

export function AssetPreviewModal({ asset, previewUrl, onClose }: Props) {
  const [prevPreviewUrl, setPrevPreviewUrl] = useState(previewUrl)
  const [resolvedUrl, setResolvedUrl] = useState(previewUrl)

  const supabase = createClient()

  useEffect(() => {
    if (resolvedUrl) return
    const isImageOrVideo = isImage(asset.mime_type) || isVideo(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode'
    if (!isImageOrVideo) return

    let active = true
    const resolveOnDemand = async () => {
      try {
        let filePathToSign = asset.file_path
        if (asset.mime_type === 'application/x-widget-qrcode') {
          try {
            const config = JSON.parse(asset.file_path)
            filePathToSign = config.png_path
          } catch {}
        }
        const url = await getCachedSignedUrl(supabase, filePathToSign, 3600)
        if (active && url) {
          setResolvedUrl(url)
        }
      } catch (err) {
        console.error('Failed to resolve signed URL on-demand in AssetPreviewModal:', err)
      }
    }
    resolveOnDemand()
    return () => {
      active = false
    }
  }, [resolvedUrl, asset.mime_type, asset.file_path, supabase])

  const dialogRef = useA11yModal({
    id: 'asset-preview-modal',
    onClose,
    initialFocusSelector: 'button[data-modal-close="true"]',
  })

  if (previewUrl !== prevPreviewUrl) {
    setPrevPreviewUrl(previewUrl)
    setResolvedUrl(previewUrl)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const isImg = isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode'
  const isVid = isVideo(asset.mime_type)
  const isYouTube = asset.mime_type === 'application/x-widget-youtube'
  const isYouTubePlaylist = asset.mime_type === 'application/x-widget-youtube-playlist'
  const isRemoteUrl = asset.mime_type === 'application/x-widget-remote-url'
  const isHtml = asset.mime_type === 'application/x-widget-html'

  let youtubeVideoId = ''
  let youtubeCcEnabled = false
  if (isYouTube) {
    let youtubeUrl = asset.file_path
    try {
      const parsed = JSON.parse(asset.file_path)
      if (parsed && typeof parsed === 'object' && parsed.url) {
        youtubeUrl = parsed.url
        youtubeCcEnabled = !!parsed.ccEnabled
      }
    } catch {}
    youtubeVideoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
  }

  let playlistId = ''
  let playlistCcEnabled = false
  if (isYouTubePlaylist) {
    let playlistUrl = asset.file_path
    try {
      const parsed = JSON.parse(asset.file_path)
      if (parsed && typeof parsed === 'object') {
        playlistUrl = parsed.url || ''
        playlistCcEnabled = !!parsed.ccEnabled
      }
    } catch {}
    const listParam = playlistUrl.match(/[?&]list=([^#\&\?]+)/)
    if (listParam) {
      playlistId = listParam[1]
    } else {
      const trimmed = playlistUrl.trim()
      if (/^[A-Za-z0-9_-]{18,40}$/.test(trimmed)) {
        playlistId = trimmed
      }
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick} role="presentation">
      <div
        ref={dialogRef as unknown as React.RefObject<HTMLDivElement>}
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
                : isYouTubePlaylist
                  ? 'YouTube Playlist Widget'
                  : isRemoteUrl
                    ? 'Remote URL Widget'
                  : isHtml
                    ? 'Text/HTML Widget'
                    : asset.mime_type === 'application/x-widget-flow'
                      ? 'Clock Widget'
                      : asset.mime_type === 'application/x-widget-worldclock'
                        ? 'World Clock Widget'
                          : asset.mime_type === 'application/x-widget-countdown'
                            ? 'Countdown Widget'
                            : asset.mime_type === 'application/x-widget-countup'
                              ? 'CountUp Widget'
                            : asset.mime_type === 'application/x-widget-slideshow'
                              ? 'Online Slideshow Widget'
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
          {isImg && resolvedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolvedUrl} alt={asset.file_name} className={styles.modalMedia} style={{ maxHeight: '70vh', objectFit: 'contain' }} />
          ) : isVid && resolvedUrl ? (
            <video src={resolvedUrl} controls autoPlay className={styles.modalMedia} style={{ maxHeight: '70vh', maxWidth: '100%' }} />
          ) : isYouTube && youtubeVideoId ? (
            <iframe 
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1${youtubeCcEnabled ? '&cc_load_policy=1' : ''}`}
              style={{ width: '100%', aspectRatio: '16/9', border: 'none', maxHeight: '70vh' }}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          ) : isYouTubePlaylist && playlistId ? (
            <iframe 
              src={`https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1${playlistCcEnabled ? '&cc_load_policy=1' : ''}`}
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
          })() : asset.mime_type === 'application/x-widget-worldclock' ? (() => {
            try {
              const config = JSON.parse(asset.file_path)
              return (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlowWorldClockRenderer
                    timezone={config.timezone}
                    clockType={config.clockType}
                    theme={config.theme}
                    primaryColor={config.themeSettings?.primaryColor}
                    secondaryColor={config.themeSettings?.secondaryColor}
                    backgroundColor={config.themeSettings?.backgroundColor}
                    textColor={config.themeSettings?.textColor}
                    use24Hour={config.use24Hour}
                    showSeconds={config.showSeconds}
                  />
                </div>
              )
            } catch (err) {
              console.error('Failed to parse World Clock widget config in preview:', err)
              return <div style={{ color: 'red', padding: '20px' }}>Error rendering World Clock widget</div>
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
          })() : asset.mime_type === 'application/x-widget-slideshow' ? (
            <SlideshowPreview filePath={asset.file_path} />
          ) : (
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
