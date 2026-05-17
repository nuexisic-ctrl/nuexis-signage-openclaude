'use client'

import { useState } from 'react'
import PlaylistEngine from './PlaylistEngine'
import styles from './player.module.css'
import type { RealtimeChannel } from './types'

interface PairedViewProps {
  contentType: string | null
  assetUrl: string | null
  mimeType: string | null
  playlistId: string | null
  scaleMode: string
  isMuted: boolean
  orientation: number
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>
  onUnpair: () => void
  onOrientationChange: (val: number) => void
  onMuteToggle: () => void
}

export default function PairedView({
  contentType, assetUrl, mimeType, playlistId,
  scaleMode, isMuted, orientation,
  supabase, onUnpair, onOrientationChange, onMuteToggle,
}: PairedViewProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(console.error)
    } else {
      await document.exitFullscreen().catch(console.error)
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

  // ── Content renderer ─────────────────────────────────────────────
  let content = null
  if (contentType === 'Asset' && assetUrl) {
    if (mimeType === 'application/x-widget-youtube') {
      const videoId = assetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
      content = (
        <iframe
          key={assetUrl}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0`}
          style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      )
    } else if (mimeType === 'application/x-widget-remote-url') {
      content = (
        <iframe
          key={assetUrl}
          src={assetUrl}
          style={{ ...mediaStyle, border: 'none' }}
          allow="autoplay; encrypted-media; fullscreen"
        />
      )
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
    content = <PlaylistEngine playlistId={playlistId} supabase={supabase} scaleMode={scaleMode} isMuted={isMuted} />
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

  return (
    <div className={styles.pairedView} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}>
      <div style={containerStyle}>
        {content}
      </div>

      {/* ── Controls overlay ─────────────────────────────────────── */}
      <div className={styles.controlsOverlay}>
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

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <>
          <div className={styles.sidebarBackdrop} onClick={() => setIsSidebarOpen(false)} />
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2>Nu<span>Exis</span></h2>
              <button className={styles.closeButton} onClick={() => setIsSidebarOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.sidebarContent}>
              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Device Actions</span>
                <button className={styles.menuButton} onClick={() => window.location.assign(window.location.pathname)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Refresh
                </button>
                <button className={`${styles.menuButton} ${styles.danger}`} onClick={onUnpair}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Unpair Device
                </button>
              </div>

              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Audio</span>
                <button className={styles.menuButton} onClick={onMuteToggle}>
                  {isMuted ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L5.25 9v6h3.53l3.97 3.97v-13.94l-3.97 3.97z" />
                      </svg>
                      Unmute
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                      </svg>
                      Mute
                    </>
                  )}
                </button>
              </div>

              <div className={styles.menuItem}>
                <span className={styles.menuItemLabel}>Orientation</span>
                <select className={styles.menuSelect} value={orientation} onChange={(e) => onOrientationChange(Number(e.target.value))}>
                  <option value={0}>0° (Landscape)</option>
                  <option value={90}>90° (Portrait CW)</option>
                  <option value={180}>180° (Landscape Flipped)</option>
                  <option value={270}>270° (Portrait CCW)</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
