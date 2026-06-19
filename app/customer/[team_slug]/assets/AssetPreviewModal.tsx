'use client'

import { useState, useEffect } from 'react'
import { File } from 'lucide-react'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'
import FlowSlideshowRenderer, { SlideshowImage } from '@/app/components/FlowSlideshowRenderer'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'
import styles from './Modal.module.css'

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
  const { t } = useTranslation()
  const [images, setImages] = useState<SlideshowImage[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let isCancelled = false
    const loadAndResolve = async () => {
      try {
        const config = JSON.parse(filePath)
        const rawImages = config.images || []
        const resolved = await Promise.all(
          rawImages.map(async (img: any) => {
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
  }, [filePath])

  if (loading) {
    return (
      <div style={{ color: '#aaa', padding: '40px', textAlign: 'center' }}>
        {t('Resolving slideshow images…')}
      </div>
    )
  }

  try {
    const config = JSON.parse(filePath)
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
  } catch {
    return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering Slideshow widget')}</div>
  }
}

export function AssetPreviewModal({ asset, previewUrl, onClose }: Props) {
  const { t } = useTranslation()
  
  const isImg = isImage(asset.mime_type) || asset.mime_type === 'application/x-widget-qrcode'
  const isVid = isVideo(asset.mime_type)
  const isYouTube = asset.mime_type === 'application/x-widget-youtube'
  const isYouTubePlaylist = asset.mime_type === 'application/x-widget-youtube-playlist'
  const isRemoteUrl = asset.mime_type === 'application/x-widget-remote-url' || asset.mime_type === 'application/x-widget-website'
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

  const getSubtitle = () => {
    if (isYouTube) return t('YouTube Widget')
    if (isYouTubePlaylist) return t('YouTube Playlist Widget')
    if (isRemoteUrl) return t('Remote URL Widget')
    if (isHtml) return t('Text/HTML Widget')
    if (asset.mime_type === 'application/x-widget-flow') return t('Clock Widget')
    if (asset.mime_type === 'application/x-widget-worldclock') return t('World Clock Widget')
    if (asset.mime_type === 'application/x-widget-countdown') return t('Countdown Widget')
    if (asset.mime_type === 'application/x-widget-countup') return t('CountUp Widget')
    if (asset.mime_type === 'application/x-widget-slideshow') return t('Online Slideshow Widget')
    if (asset.mime_type === 'application/x-widget-qrcode') return t('QR Code Widget')
    return asset.mime_type
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={asset.file_name}
      subtitle={getSubtitle()}
      maxWidth="900px"
    >
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
                    \${css}
                  </style>
                </head>
                <body>
                  \${html}
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
            return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering custom HTML widget')}</div>
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
            return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering Countdown widget')}</div>
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
            return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering CountUp widget')}</div>
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
            return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering World Clock widget')}</div>
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
            return <div style={{ color: 'red', padding: '20px' }}>{t('Error rendering Clock widget')}</div>
          }
        })() : asset.mime_type === 'application/x-widget-slideshow' ? (
          <SlideshowPreview filePath={asset.file_path} />
        ) : (
          <div className={styles.modalUnsupported} style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
            <File aria-hidden="true" size={48} className={styles.unsupportedIcon} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>{t('Preview not available for this type.')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
