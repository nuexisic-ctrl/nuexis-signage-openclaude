'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Maximize, Minimize, Move, Tv } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import styles from './ScreenPreviewModal.module.css'
import { Device, Asset, Playlist } from './types'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'

interface Props {
  device: Device
  teamSlug: string
  onClose: () => void
  // Current form values passed from AssignModal (unsaved options can be tested!)
  contentType: 'Asset' | 'Playlist' | 'Schedule'
  assetId: string | null
  playlistId: string | null
  scaleMode: string
  orientation: number
  assets: Asset[]
  playlists: Playlist[]
}

interface PlaylistItem {
  id: string
  type: string
  asset_id: string | null
  duration_seconds: number
  sort_order: number
  widget_type: string | null
  widget_config: any
  assets?: {
    file_path: string
    mime_type: string
  } | null
}

export function ScreenPreviewModal({
  device,
  teamSlug,
  onClose,
  contentType,
  assetId,
  playlistId,
  scaleMode,
  orientation,
  assets,
  playlists
}: Props) {
  const supabase = createClient()
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait' | 'custom'>('landscape')
  const [customWidth, setCustomWidth] = useState(960)
  const [customHeight, setCustomHeight] = useState(540)
  const [customRatio, setCustomRatio] = useState('16:9')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [playlistIndex, setPlaylistIndex] = useState(0)
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [resizing, setResizing] = useState(false)

  const dragStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── 1. Fetch Playlist items if Content Type is Playlist ─────────────────
  useEffect(() => {
    if (contentType !== 'Playlist' || !playlistId) {
      setPlaylistItems([])
      return
    }

    let active = true
    const loadPlaylist = async () => {
      setPlaylistLoading(true)
      try {
        const { data, error } = await supabase
          .from('playlist_items')
          .select('*, assets:asset_id(file_path, mime_type)')
          .eq('playlist_id', playlistId)
          .order('sort_order', { ascending: true })

        if (error) throw error
        if (active && data) {
          setPlaylistItems(data as PlaylistItem[])
          setPlaylistIndex(0)
        }
      } catch (err) {
        console.error('Failed to load preview playlist items:', err)
      } finally {
        if (active) setPlaylistLoading(false)
      }
    }

    loadPlaylist()

    return () => {
      active = false
    }
  }, [contentType, playlistId, supabase])

  // ── 2. Real-time media URL signing (for private buckets) ──────────────────
  useEffect(() => {
    let active = true
    const pathsToSign: string[] = []

    // Collect single asset path
    if (contentType === 'Asset' && assetId) {
      const a = assets.find(item => item.id === assetId)
      if (a && a.file_path && !a.mime_type.startsWith('application/x-widget')) {
        pathsToSign.push(a.file_path)
      }
    }

    // Collect playlist assets paths
    playlistItems.forEach(item => {
      if (item.assets?.file_path && !item.assets.mime_type.startsWith('application/x-widget')) {
        pathsToSign.push(item.assets.file_path)
      }
    })

    if (pathsToSign.length === 0) return

    const signUrls = async () => {
      const urls: Record<string, string> = {}
      const promises = Array.from(new Set(pathsToSign)).map(async (filePath) => {
        try {
          const url = await getCachedSignedUrl(supabase, filePath, 3600)
          if (url) {
            urls[filePath] = url
          }
        } catch (err) {
          console.error('Failed to sign asset path:', filePath, err)
        }
      })
      await Promise.all(promises)
      if (active) {
        setSignedUrls(urls)
      }
    }

    signUrls()

    return () => {
      active = false
    }
  }, [contentType, assetId, playlistItems, assets, supabase])

  // ── 3. Playlist items automatic sequencing ──────────────────────────────
  useEffect(() => {
    if (playlistItems.length <= 1) return

    const activeItem = playlistItems[playlistIndex]
    const duration = (activeItem?.duration_seconds || 10) * 1000

    const timeout = setTimeout(() => {
      setPlaylistIndex((prev) => (prev + 1) % playlistItems.length)
    }, duration)

    return () => clearTimeout(timeout)
  }, [playlistIndex, playlistItems])

  // ── 4. Sizing Snapping & Orientation Swap ───────────────────────────────
  const isRotated = orientation === 90 || orientation === 270

  const getSimulatedDimensions = () => {
    if (previewMode === 'landscape') {
      // 16:9 standard, swap for vertical screens
      return isRotated ? { w: 450, h: 800 } : { w: 800, h: 450 }
    } else if (previewMode === 'portrait') {
      // 9:16 standard, swap for vertical screens
      return isRotated ? { w: 800, h: 450 } : { w: 450, h: 800 }
    }
    // Custom
    return { w: customWidth, h: customHeight }
  }

  const { w: width, h: height } = getSimulatedDimensions()

  // ── 5. Fullscreen control ───────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error)
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(console.error)
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // ── 6. Aspect Ratio select preset mapping ──────────────────────────────
  const handleRatioChange = (val: string) => {
    setCustomRatio(val)
    if (val === 'custom') return

    const [rw, rh] = val.split(':').map(Number)
    if (rw && rh) {
      // Scale matching 960px width
      const targetW = 960
      const targetH = Math.round((targetW * rh) / rw)
      setCustomWidth(targetW)
      setCustomHeight(targetH)
    }
  }

  // ── 7. Sizing Resize Handles logic ──────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: customWidth,
      h: customHeight
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing || !dragStartRef.current) return

      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y

      let newWidth = Math.max(280, dragStartRef.current.w + dx * 2) // double change since centered
      let newHeight = Math.max(180, dragStartRef.current.h + dy * 2)

      if (customRatio !== 'custom') {
        const [rw, rh] = customRatio.split(':').map(Number)
        if (rw && rh) {
          // preserve aspect ratio relative to largest drag change
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = Math.round((newWidth * rh) / rw)
          } else {
            newWidth = Math.round((newHeight * rw) / rh)
          }
        }
      }

      setCustomWidth(newWidth)
      setCustomHeight(newHeight)
    }

    const handleMouseUp = () => {
      setResizing(false)
      dragStartRef.current = null
    }

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, customRatio])

  // ── 8. Real player rendering layout logic ──────────────────────────────
  const objectFitMap: Record<string, 'none' | 'contain' | 'fill' | 'cover'> = {
    'None': 'none',
    'Fit': 'contain',
    'Stretch': 'fill',
    'Zoom': 'cover',
  }
  const fit = objectFitMap[scaleMode] || 'contain'

  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: fit,
  }

  const renderActiveContent = (itemMime: string | null, itemPath: string | null, isVideoAsset: boolean) => {
    if (!itemPath) return null

    if (itemMime === 'application/x-widget-youtube') {
      let youtubeUrl = itemPath
      let ccEnabled = false
      try {
        const parsed = JSON.parse(itemPath)
        if (parsed && typeof parsed === 'object' && parsed.url) {
          youtubeUrl = parsed.url
          ccEnabled = !!parsed.ccEnabled
        }
      } catch {}

      const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
      const ccParam = ccEnabled ? '&cc_load_policy=1' : ''
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0${ccParam}`}
          style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        />
      )
    }

    if (itemMime === 'application/x-widget-youtube-playlist') {
      let playlistUrl = itemPath
      let ccEnabled = false
      try {
        const parsed = JSON.parse(itemPath)
        if (parsed && typeof parsed === 'object') {
          playlistUrl = parsed.url || ''
          ccEnabled = !!parsed.ccEnabled
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

      const ccParam = ccEnabled ? '&cc_load_policy=1' : ''
      return (
        <iframe
          src={`https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&mute=1&loop=1&controls=0${ccParam}`}
          style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        />
      )
    }

    if (itemMime === 'application/x-widget-remote-url') {
      return (
        <iframe
          src={itemPath}
          style={{ ...mediaStyle, border: 'none' }}
          allow="autoplay; encrypted-media; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        />
      )
    }

    if (itemMime === 'application/x-widget-html') {
      try {
        const { html = '', css = '' } = JSON.parse(itemPath)
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
            title="widget-html-simulator"
            srcDoc={iframeSrcDoc}
            style={{ ...mediaStyle, border: 'none' }}
            sandbox=""
          />
        )
      } catch (err) {
        console.error('Failed to render custom html widget in simulator:', err)
        return <div style={{ color: 'red', padding: '10px' }}>Error rendering custom HTML widget</div>
      }
    }

    if (itemMime === 'application/x-widget-flow') {
      try {
        const config = JSON.parse(itemPath)
        return (
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
        console.error('Failed to render Clock widget in simulator:', err)
        return <div style={{ color: 'red', padding: '10px' }}>Error rendering Clock widget</div>
      }
    }

    if (itemMime === 'application/x-widget-worldclock') {
      try {
        const config = JSON.parse(itemPath)
        return (
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
        console.error('Failed to render World Clock widget in simulator:', err)
        return <div style={{ color: 'red', padding: '10px' }}>Error rendering World Clock widget</div>
      }
    }

    if (itemMime === 'application/x-widget-countdown') {
      try {
        const config = JSON.parse(itemPath)
        return (
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
        console.error('Failed to render Countdown widget in simulator:', err)
        return <div style={{ color: 'red', padding: '10px' }}>Error rendering Countdown widget</div>
      }
    }

    if (itemMime === 'application/x-widget-countup') {
      try {
        const config = JSON.parse(itemPath)
        return (
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
        )
      } catch (err) {
        console.error('Failed to render CountUp widget in simulator:', err)
        return <div style={{ color: 'red', padding: '10px' }}>Error rendering CountUp widget</div>
      }
    }

    if (isVideoAsset || itemMime?.startsWith('video/')) {
      const url = signedUrls[itemPath] || itemPath
      return (
        <video
          src={url}
          style={mediaStyle}
          loop
          autoPlay
          playsInline
          muted
        />
      )
    }

    // Image/General fallback
    const url = signedUrls[itemPath] || itemPath
    return <img src={url} style={mediaStyle} alt="Simulated signage content" />
  }

  let contentNode = null
  if (contentType === 'Asset' && assetId) {
    const a = assets.find(item => item.id === assetId)
    if (a) {
      const isVideoAsset = a.mime_type?.startsWith('video/')
      contentNode = renderActiveContent(a.mime_type, a.file_path, isVideoAsset)
    }
  } else if (contentType === 'Playlist' && playlistId) {
    if (playlistLoading) {
      contentNode = (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p className={styles.emptyText}>Loading Simulator Media...</p>
        </div>
      )
    } else if (playlistItems.length === 0) {
      contentNode = (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Playlist is empty</p>
        </div>
      )
    } else {
      const currentItem = playlistItems[playlistIndex]
      if (currentItem) {
        if (currentItem.type === 'widget' && currentItem.widget_type) {
          // Custom widgets support
          contentNode = (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
              <h2 style={{ color: '#fff', fontFamily: 'sans-serif' }}>{currentItem.widget_type.toUpperCase()}</h2>
            </div>
          )
        } else {
          const isVideoAsset = currentItem.type === 'video' || !!currentItem.assets?.mime_type?.startsWith('video/')
          contentNode = renderActiveContent(
            currentItem.assets?.mime_type || null,
            currentItem.assets?.file_path || null,
            isVideoAsset
          )
        }
      }
    }
  } else {
    contentNode = (
      <div className={styles.emptyState}>
        <Tv size={36} style={{ opacity: 0.6 }} />
        <p className={styles.emptyText}>Screen Simulator Online</p>
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Waiting for Asset or Playlist assignment...</span>
      </div>
    )
  }

  // ── 9. Simulated Screen Rotation ───────────────────────────────────────
  // We rotate inside the frame to mirror actual web players
  const rotationStyle: React.CSSProperties = {
    width: isRotated ? `${height}px` : '100%',
    height: isRotated ? `${width}px` : '100%',
    transform: isRotated ? `rotate(${orientation}deg)` : 'none',
    transformOrigin: 'center center',
    position: 'absolute',
    top: isRotated ? '50%' : 0,
    left: isRotated ? '50%' : 0,
    marginLeft: isRotated ? `${-height / 2}px` : 0,
    marginTop: isRotated ? `${-width / 2}px` : 0,
    overflow: 'hidden',
  }

  return (
    <div className={styles.overlay} ref={containerRef}>
      {/* ── Header Toolbar ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>{device.name || 'Unnamed Screen'} simulator</h2>
          <div className={styles.metaInfo}>
            <span className={styles.badge}>{fit.toUpperCase()}</span>
            <span className={styles.badge}>{orientation}° orientation</span>
            <span className={`${styles.badge} ${styles.badgeActive}`}>{contentType.toUpperCase()} MODE</span>
          </div>
        </div>

        {/* ── Mode selector ── */}
        <div className={styles.controlsCenter}>
          <button
            onClick={() => setPreviewMode('landscape')}
            className={`${styles.modeBtn} ${previewMode === 'landscape' ? styles.modeBtnActive : ''}`}
          >
            Landscape (16:9)
          </button>
          <button
            onClick={() => setPreviewMode('portrait')}
            className={`${styles.modeBtn} ${previewMode === 'portrait' ? styles.modeBtnActive : ''}`}
          >
            Portrait (9:16)
          </button>
          <button
            onClick={() => setPreviewMode('custom')}
            className={`${styles.modeBtn} ${previewMode === 'custom' ? styles.modeBtnActive : ''}`}
          >
            Custom Sizing
          </button>

          {previewMode === 'custom' && (
            <div className={styles.customInputs}>
              <div className={styles.inputGroup}>
                <label>W</label>
                <input
                  type="number"
                  value={customWidth}
                  min={280}
                  max={2560}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className={styles.dimensionInput}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>H</label>
                <input
                  type="number"
                  value={customHeight}
                  min={180}
                  max={1440}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className={styles.dimensionInput}
                />
              </div>
              <select
                value={customRatio}
                onChange={(e) => handleRatioChange(e.target.value)}
                className={styles.aspectSelect}
              >
                <option value="custom">Custom Ratio</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="16:10">16:10</option>
                <option value="4:3">4:3</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Fullscreen and Close actions ── */}
        <div className={styles.actionsRight}>
          <button
            onClick={toggleFullscreen}
            className={styles.iconBtn}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            onClick={onClose}
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            title="Exit Simulator"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Simulator Viewing Window ── */}
      <div className={styles.simulatorArea}>
        <div
          className={`${styles.displayWrapper} ${resizing ? styles.resizing : ''}`}
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <div className={styles.displayFrame}>
            <div style={rotationStyle}>
              {contentNode}
            </div>
          </div>

          {/* Sizing Grab Handle */}
          {previewMode === 'custom' && (
            <div
              className={styles.resizeHandle}
              onMouseDown={handleMouseDown}
              title="Drag to resize simulated display"
            >
              <Move className={styles.resizeIcon} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
