'use client'

import { useState, useEffect, useRef } from 'react'
import PlaylistEngine from './PlaylistEngine'
import styles from './player.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'
import FlowSlideshowRenderer from '@/app/components/FlowSlideshowRenderer'
import { X, Monitor, RefreshCw, Volume2, VolumeX, Unlink } from 'lucide-react'
import { ShadowDOMHtmlRenderer, ShadowDOMRemoteURLRenderer } from './ShadowDOMRenderer'
import WeatherRenderer from '@/app/components/WeatherRenderer'
import NewsTickerRenderer from '@/app/components/NewsTickerRenderer'

interface PairedViewProps {
  contentType: string | null
  assetUrl: string | null
  mimeType: string | null
  playlistId: string | null
  scaleMode: string
  isMuted: boolean
  orientation: number
  hardwareId: string
  secret: string
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>
  onUnpair: () => void
  onOrientationChange: (val: number) => void
  onMuteToggle: () => void
}

export default function PairedView({
  contentType, assetUrl, mimeType, playlistId,
  scaleMode, isMuted, orientation,
  hardwareId, secret,
  supabase, onUnpair, onOrientationChange, onMuteToggle,
}: PairedViewProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showOrientationModal, setShowOrientationModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [isVisible, setIsVisible] = useState(false)
  const controlsOverlayRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // If sidebar or orientation modal is open, force visible
    if (isSidebarOpen || showOrientationModal) {
      setIsVisible(true)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
      return
    }

    const handlePointerMove = (clientX: number, clientY: number) => {
      const el = controlsOverlayRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      
      // Calculate distance to the rectangle
      // If cursor is inside, distance is 0.
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 180) {
        setIsVisible(true)
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }
      } else {
        // Start hide timeout if not already started
        if (!hideTimeoutRef.current) {
          hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false)
            hideTimeoutRef.current = null
          }, 800)
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY)
    }

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchstart', onTouch)
    window.addEventListener('touchmove', onTouch)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [isSidebarOpen, showOrientationModal])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(console.error)
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen().catch(console.error)
      setIsFullscreen(false)
    }
  }

  const objectFitMap: Record<string, 'none' | 'contain' | 'fill' | 'cover'> = {
    'None': 'none',
    'Fit': 'contain',
    'Stretch': 'fill',
    'Zoom': 'cover',
  }

  const fit = objectFitMap[scaleMode] || 'contain'

  const containerStyle: React.CSSProperties = {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', overflow: 'hidden',
  }

  const mediaStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: fit,
  }

  // ── Rotation transform only for the signage media viewport (upright controls) ──
  const isRotated = orientation === 90 || orientation === 270

  const contentWrapperStyle: React.CSSProperties = {
    width: isRotated ? '100vh' : '100vw',
    height: isRotated ? '100vw' : '100vh',
    transform: `rotate(${orientation}deg)`,
    transformOrigin: 'center center',
    position: 'absolute',
    top: '50%', left: '50%',
    marginLeft: isRotated ? '-50vh' : '-50vw',
    marginTop: isRotated ? '-50vw' : '-50vh',
    overflow: 'hidden',
    backgroundColor: '#000000',
  }

  // ── Content renderer ─────────────────────────────────────────────
  let content = null
  if (contentType === 'Asset' && assetUrl) {
    if (mimeType === 'application/x-widget-youtube') {
      let youtubeUrl = assetUrl
      let ccEnabled = false
      try {
        const parsed = JSON.parse(assetUrl)
        if (parsed && typeof parsed === 'object' && parsed.url) {
          youtubeUrl = parsed.url
          ccEnabled = !!parsed.ccEnabled
        }
      } catch {}

      const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
      const ccParam = ccEnabled ? '&cc_load_policy=1' : ''
      content = (
        <iframe
          key={assetUrl}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0${ccParam}`}
          style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        />
      )
    } else if (mimeType === 'application/x-widget-youtube-playlist') {
      let playlistUrl = assetUrl
      let ccEnabled = false
      let shuffleEnabled = false
      try {
        const parsed = JSON.parse(assetUrl)
        if (parsed && typeof parsed === 'object') {
          playlistUrl = parsed.url || ''
          ccEnabled = !!parsed.ccEnabled
          shuffleEnabled = !!parsed.shuffleEnabled
        }
      } catch {}

      let playlistId = ''
      const listParam = playlistUrl.match(/[?&]list=([^#\&\?]+)/)
      if (listParam) {
        playlistId = listParam[1]
      } else {
        const trimmed = playlistUrl.trim()
        if (/^[A-Za-z0-9_-]{18,40}$/.test(trimmed)) {
          playlistId = trimmed
        }
      }

      content = (
        <div style={{ ...mediaStyle, overflow: 'hidden' }}>
          <YouTubePlaylistPlayer
            playlistId={playlistId}
            shuffle={shuffleEnabled}
            ccEnabled={ccEnabled}
            isMuted={isMuted}
            isActive={true}
          />
        </div>
      )
    } else if (mimeType === 'application/x-widget-remote-url' || mimeType === 'application/x-widget-website') {
      content = (
        <ShadowDOMRemoteURLRenderer
          key={assetUrl}
          url={assetUrl}
          style={mediaStyle}
        />
      )
    } else if (mimeType === 'application/x-widget-html') {
      try {
        const { html = '', css = '' } = JSON.parse(assetUrl)
        content = (
          <ShadowDOMHtmlRenderer
            key={assetUrl}
            html={html}
            css={css}
            style={mediaStyle}
          />
        )
      } catch (err) {
        console.error('Failed to parse custom html widget in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering custom HTML widget</div>
      }
    } else if (mimeType === 'application/x-widget-flow') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
          <FlowClockRenderer
            style={config.style}
            showSeconds={config.showSeconds}
            showDate={config.showDate}
            use24Hour={config.use24Hour}
            dateFormat={config.dateFormat}
            theme={config.theme}
          />
        )
      } catch (err) {
        console.error('Failed to parse Clock widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering Clock widget</div>
      }
    } else if (mimeType === 'application/x-widget-worldclock') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
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
        )
      } catch (err) {
        console.error('Failed to parse World Clock widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering World Clock widget</div>
      }
    } else if (mimeType === 'application/x-widget-countdown') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
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
        )
      } catch (err) {
        console.error('Failed to parse Countdown widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering Countdown widget</div>
      }
    } else if (mimeType === 'application/x-widget-slideshow') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
          <FlowSlideshowRenderer
            images={config.images}
            animation={config.animation}
            backgroundColor={config.backgroundColor}
            duration={config.duration}
            hardwareId={hardwareId}
            secret={secret}
          />
        )
      } catch (err) {
        console.error('Failed to parse Slideshow widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering Slideshow widget</div>
      }
    } else if (mimeType === 'application/x-widget-weather') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
          <WeatherRenderer
            city={config.city}
            unit={config.unit}
            theme={config.theme}
          />
        )
      } catch (err) {
        console.error('Failed to parse weather widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering Weather widget</div>
      }
    } else if (mimeType === 'application/x-widget-newsticker') {
      try {
        const config = JSON.parse(assetUrl)
        content = (
          <NewsTickerRenderer
            feedUrl={config.feedUrl}
            speed={config.speed}
            theme={config.theme}
            title={config.title}
          />
        )
      } catch (err) {
        console.error('Failed to parse news ticker widget config in PairedView:', err)
        content = <div style={{ color: 'red', padding: '10px' }}>Error rendering News Ticker widget</div>
      }
    } else if (mimeType?.startsWith('video/')) {
      content = (
        <video
          key={assetUrl}
          src={assetUrl}
          style={mediaStyle}
          loop autoPlay playsInline muted={isMuted}
        />
      )
    } else {
      content = (
        <img key={assetUrl} src={assetUrl} style={mediaStyle} alt="Assigned content" />
      )
    }
  } else if (contentType === 'Playlist' && playlistId) {
    content = <PlaylistEngine playlistId={playlistId} supabase={supabase} scaleMode={scaleMode} isMuted={isMuted} hardwareId={hardwareId} secret={secret} />
  } else {
    content = (
      <div className={styles.pairedFlash}>
        <svg className={styles.pairedIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className={styles.pairedText}>Screen Connected. Waiting for content...</p>
      </div>
    )
  }

  const isLandscape = orientation === 0 || orientation === 180
  const controlsOverlayStyle: React.CSSProperties = isLandscape
    ? { left: 'auto', right: '24px' }
    : {}

  return (
    <div className={styles.pairedView} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}>
      
      {/* ── Signage Screen Output (Rotated according to display configuration) ── */}
      <div style={contentWrapperStyle}>
        <div style={containerStyle}>
          {content}
        </div>
      </div>

      {/* ── Upright Controls Overlay (Outside rotated viewport) ── */}
      <div 
        ref={controlsOverlayRef} 
        className={`${styles.controlsOverlay} ${isVisible ? styles.visible : ''}`} 
        style={controlsOverlayStyle}
      >
        <button className={styles.iconButton} onClick={toggleFullscreen} title="Toggle Fullscreen">
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9h4.5M9 15v4.5M9 15H4.5M15 15v4.5M15 15h4.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
        <button className={styles.iconButton} onClick={() => setIsSidebarOpen(true)} title="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* ── Upright Sidebar Navigation Menu ── */}
      {isSidebarOpen && (
        <>
          <div className={styles.sidebarBackdrop} onClick={() => setIsSidebarOpen(false)} />
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/Nuexis-logo.png" 
                  alt="NuExis Logo" 
                  style={{ width: '180px', height: '50px', objectFit: 'contain', objectPosition: 'left center' }} 
                />
              </div>
              <button className={styles.closeButton} onClick={() => setIsSidebarOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.sidebarContent}>
              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Device Actions</span>
                <button className={styles.menuButton} onClick={() => window.location.assign(window.location.pathname)}>
                  <RefreshCw size={18} style={{ marginRight: '4px' }} />
                  Refresh
                </button>
                <button className={`${styles.menuButton} ${styles.danger}`} onClick={onUnpair}>
                  <Unlink size={18} style={{ marginRight: '4px' }} />
                  Unpair Device
                </button>
              </div>

              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Audio</span>
                <button className={styles.menuButton} onClick={onMuteToggle}>
                  {isMuted ? (
                    <>
                      <VolumeX size={18} style={{ marginRight: '4px' }} />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Volume2 size={18} style={{ marginRight: '4px' }} />
                      Mute
                    </>
                  )}
                </button>
              </div>

              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Orientation</span>
                <button 
                  className={styles.menuButton} 
                  onClick={() => setShowOrientationModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <Monitor size={18} />
                  {orientation === 0 && '0° — Landscape'}
                  {orientation === 90 && '90° — Portrait CW'}
                  {orientation === 180 && '180° — Landscape Flipped'}
                  {orientation === 270 && '270° — Portrait CCW'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Remote Friendly Landscape Orientation List Popup Modal ── */}
      {showOrientationModal && (
        <div className={styles.popupOverlay} onClick={() => setShowOrientationModal(false)}>
          <div className={styles.popupContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <h3 className={styles.popupTitle}>Select Screen Orientation</h3>
              <button className={styles.popupCloseBtn} onClick={() => setShowOrientationModal(false)} aria-label="Close selector">
                <X size={18} />
              </button>
            </div>
            <div className={styles.popupList}>
              {[
                { val: 0, label: '0° — Landscape' },
                { val: 90, label: '90° — Portrait CW' },
                { val: 180, label: '180° — Landscape Flipped' },
                { val: 270, label: '270° — Portrait CCW' }
              ].map((opt) => (
                <button 
                  key={opt.val} 
                  className={`${styles.orientationRowBtn} ${orientation === opt.val ? styles.activeRowBtn : ''}`}
                  onClick={() => {
                    onOrientationChange(opt.val)
                    setShowOrientationModal(false)
                  }}
                  tabIndex={0}
                >
                  <span className={styles.orientationRowLabel}>{opt.label}</span>
                  {orientation === opt.val && (
                    <svg className={styles.checkmarkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '18px', height: '18px', color: '#3b82f6' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── YOUTUBE PLAYLIST PLAYER ENGINE COMPONENT ──────────────────────────────

interface YouTubePlaylistPlayerProps {
  playlistId: string
  shuffle: boolean
  ccEnabled: boolean
  isMuted: boolean
  isActive: boolean
}

function YouTubePlaylistPlayer({
  playlistId,
  shuffle,
  ccEnabled,
  isMuted,
  isActive
}: YouTubePlaylistPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [apiReady, setApiReady] = useState(false)
  const playerId = useRef(`yt-player-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if ((window as any).YT && (window as any).YT.Player) {
      setApiReady(true)
      return
    }

    const previousCallback = (window as any).onYouTubeIframeAPIReady
    (window as any).onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback()
      setApiReady(true)
    }

    const tag = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (!tag) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
  }, [])

  useEffect(() => {
    if (!apiReady || !containerRef.current) return

    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch (err) {
        console.error('Error destroying YT player:', err)
      }
      playerRef.current = null
    }

    const placeholder = document.createElement('div')
    placeholder.id = playerId.current
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(placeholder)

    const playerVars: any = {
      listType: 'playlist',
      list: playlistId,
      autoplay: isActive ? 1 : 0,
      mute: isMuted ? 1 : 0,
      controls: 0,
      loop: 1,
      cc_load_policy: ccEnabled ? 1 : 0,
      rel: 0,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined
    }

    playerRef.current = new (window as any).YT.Player(playerId.current, {
      height: '100%',
      width: '100%',
      playerVars,
      events: {
        onReady: (event: any) => {
          if (shuffle) {
            event.target.setShuffle(true)
            if (isActive) {
              event.target.playVideo()
            }
          }
        }
      }
    })

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch (err) {
          console.error('Error destroying YT player in cleanup:', err)
        }
        playerRef.current = null
      }
    }
  }, [apiReady, playlistId, shuffle, ccEnabled, isMuted, isActive])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}
