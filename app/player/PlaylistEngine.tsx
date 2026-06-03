'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { getPlaylistItems, getSignedMediaUrl } from './actions'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'

interface PlaylistItem {
  id: string
  playlist_id: string | null
  type: string
  asset_id: string | null
  widget_type: string | null
  widget_config: unknown
  duration_seconds: number
  sort_order: number
  assets?: {
    file_path: string
    mime_type: string
  } | null
}

function getAssetPathAndMime(assets: { file_path: string; mime_type: string } | null | undefined) {
  if (!assets) return null
  let filePath = assets.file_path
  let mimeType = assets.mime_type
  if (mimeType === 'application/x-widget-qrcode') {
    try {
      const config = JSON.parse(filePath)
      if (config.png_path) {
        filePath = config.png_path
        mimeType = 'image/png'
      }
    } catch {}
  }
  return { filePath, mimeType }
}

export default function PlaylistEngine({ 
  playlistId, 
  supabase, 
  scaleMode, 
  isMuted,
  hardwareId,
  secret
}: { 
  playlistId: string
  supabase: SupabaseClient
  scaleMode: string
  isMuted: boolean
  hardwareId: string
  secret: string
}) {
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [fadeOpacity, setFadeOpacity] = useState(1)

  // Use a map to store cached blob URLs
  const cacheMap = useRef<Record<string, string>>({})
  // In-flight signing promises — prevents the same asset being signed concurrently
  // by both cacheAssets() and PlayableItem, which caused 4-6x duplicate sign requests
  const signingPromisesRef = useRef<Record<string, Promise<string>>>({})

  const getSignedMediaUrlDeduped = useCallback((filePath: string): Promise<string> => {
    if (filePath in signingPromisesRef.current) {
      return signingPromisesRef.current[filePath]
    }
    const promise = getSignedMediaUrl(filePath, hardwareId, secret).finally(() => {
      delete signingPromisesRef.current[filePath]
    })
    signingPromisesRef.current[filePath] = promise
    return promise
  }, [hardwareId, secret])

  useEffect(() => {
    let mounted = true

    const cacheAssets = async (playlistItems: PlaylistItem[]) => {
      if (typeof window === 'undefined' || !('caches' in window)) {
        console.warn('[PlaylistEngine] Cache Storage API is not supported in this browser context.')
        return
      }
      try {
        const cache = await caches.open('nuexis-playlist-cache')
        for (const item of playlistItems) {
          if ((item.type === 'image' || item.type === 'video') && item.assets) {
            const resolved = getAssetPathAndMime(item.assets)
            if (!resolved) continue
            const { filePath, mimeType } = resolved

            // Skip widget types
            if (mimeType.startsWith('application/x-widget')) continue
            
            // Use a consistent filepath cache key instead of the expiring signed URL (H-03)
            const cacheKey = `https://local-media-cache/${filePath}`
            
            let response = await cache.match(cacheKey)
            if (!response) {
              // Use deduplicated signing to prevent concurrent duplicate requests
              const url = await getSignedMediaUrlDeduped(filePath)
              response = await fetch(url, { mode: 'cors' })
              if (response.ok) {
                await cache.put(cacheKey, response.clone())
              }
            }
            
            if (response && response.ok && !cacheMap.current[filePath]) {
              const blob = await response.blob()
              cacheMap.current[filePath] = URL.createObjectURL(blob)
            }
          }
        }

        // Evict stale assets from Cache Storage (H-19)
        const keys = await cache.keys()
        const activeCacheKeys = new Set<string>()
        playlistItems.forEach(item => {
          if ((item.type === 'image' || item.type === 'video') && item.assets) {
            const resolved = getAssetPathAndMime(item.assets)
            if (resolved && !resolved.mimeType.startsWith('application/x-widget')) {
              activeCacheKeys.add(`https://local-media-cache/${resolved.filePath}`)
            }
          }
        })

        for (const request of keys) {
          if (!activeCacheKeys.has(request.url)) {
            await cache.delete(request)
          }
        }

        // Evict stale blob URLs from memory (H-14)
        const activeFilePaths = new Set<string>()
        playlistItems.forEach(item => {
          if ((item.type === 'image' || item.type === 'video') && item.assets) {
            const resolved = getAssetPathAndMime(item.assets)
            if (resolved) {
              activeFilePaths.add(resolved.filePath)
            }
          }
        })

        Object.keys(cacheMap.current).forEach((filePath) => {
          if (!activeFilePaths.has(filePath)) {
            URL.revokeObjectURL(cacheMap.current[filePath])
            delete cacheMap.current[filePath]
          }
        })
      } catch (err) {
        console.error('[PlaylistEngine] Failed to cache assets:', err)
      }
    }

    const fetchItems = async (showLoading = true) => {
      if (showLoading && mounted) setIsLoading(true)
      const data = await getPlaylistItems(playlistId, hardwareId, secret)
      if (!mounted) return
      
      setItems((currentItems) => {
        // Graceful swap: if the currently playing item still exists in the new playlist,
        // try to maintain the logical flow. Otherwise, just reset to index 0.
        if (currentItems.length > 0) {
          setCurrentIndex((prevIndex) => {
            const currentlyPlayingId = currentItems[prevIndex]?.id
            const newIndex = data.findIndex((d: PlaylistItem) => d.id === currentlyPlayingId)
            return newIndex !== -1 ? newIndex : 0
          })
        }
        return data
      })
      
      if (showLoading && mounted) setIsLoading(false)
      
      // Start background caching for physical assets
      if (data && data.length > 0) {
        cacheAssets(data)
      }
    }

    fetchItems(false)

    // Realtime listener for broadcast refresh signals
    const channel = supabase
      .channel(`playlist-broadcast-${playlistId}`)
      .on(
        'broadcast',
        { event: 'refresh' },
        () => {
          
          // Professional hard-refresh: fade out the screen before reloading to prevent jarring cuts (M-17)
          setFadeOpacity(0)
          
          setTimeout(() => {
            fetchItems(true)
            setFadeOpacity(1)
          }, 500)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
      
      // Cleanup object URLs to prevent memory leaks
      Object.values(cacheMap.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      cacheMap.current = {}
      signingPromisesRef.current = {}
    }
  }, [playlistId, supabase, hardwareId, secret, getSignedMediaUrlDeduped])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }, [items.length])

  if (isLoading) {
    return <div style={{ color: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Playlist...</div>
  }

  if (items.length === 0) {
    return <div style={{ color: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Playlist is empty</div>
  }

  const currentItem = items[currentIndex]
  const nextIndex = (currentIndex + 1) % items.length
  const nextItem = items[nextIndex]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', opacity: fadeOpacity, transition: 'opacity 0.5s ease-out' }}>
      {/* Background/Next item (Preloading) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, opacity: 0 }}>
        {items.length > 1 && (
            <PlayableItem 
              key={`preload-${nextItem.id}-${nextIndex}`} 
              item={nextItem} 
              scaleMode={scaleMode} 
              isMuted={isMuted} 
              hardwareId={hardwareId}
              secret={secret}
              cacheMap={cacheMap}
              getSignedUrl={getSignedMediaUrlDeduped}
              onComplete={() => {}} // Preload doesn't trigger advance
              isActive={false}
            />
        )}
      </div>

      {/* Active item */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
        <PlayableItem 
          key={`active-${currentItem.id}-${currentIndex}`} 
          item={currentItem} 
          scaleMode={scaleMode} 
          isMuted={isMuted} 
          cacheMap={cacheMap}
          hardwareId={hardwareId}
          secret={secret}
          getSignedUrl={getSignedMediaUrlDeduped}
          onComplete={handleNext}
          isActive={true}
        />
      </div>
    </div>
  )
}

interface PlayableItemProps {
  item: PlaylistItem
  scaleMode: string
  isMuted: boolean
  cacheMap: React.MutableRefObject<Record<string, string>>
  hardwareId: string
  secret: string
  getSignedUrl: (filePath: string) => Promise<string>
  onComplete: () => void
  isActive: boolean
}

function PlayableItem({ 
  item, 
  scaleMode, 
  isMuted, 
  cacheMap, 
  hardwareId, 
  secret, 
  getSignedUrl, 
  onComplete, 
  isActive 
}: PlayableItemProps) {
  const getInitialMediaUrl = () => {
    if (item.assets) {
      const resolved = getAssetPathAndMime(item.assets)
      if (resolved) {
        const { filePath, mimeType } = resolved
        if (
          mimeType === 'application/x-widget-youtube' || 
          mimeType === 'application/x-widget-remote-url' ||
          mimeType === 'application/x-widget-html' ||
          mimeType === 'application/x-widget-flow'
        ) {
          return filePath
        }
        
        // Return cached URL from ref if exists
        const cached = cacheMap.current[filePath]
        if (cached) {
          return cached
        }
      }
    }
    return null
  }

  const getInitialIsLoaded = () => {
    if (!item.assets) {
      return true
    }
    const resolved = getAssetPathAndMime(item.assets)
    if (resolved) {
      const { mimeType } = resolved
      if (
        mimeType === 'application/x-widget-youtube' || 
        mimeType === 'application/x-widget-remote-url' ||
        mimeType === 'application/x-widget-html' ||
        mimeType === 'application/x-widget-flow'
      ) {
        return true
      }
    }
    return false
  }

  const [mediaUrl, setMediaUrl] = useState<string | null>(getInitialMediaUrl)
  const [isLoaded, setIsLoaded] = useState(getInitialIsLoaded)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    let mounted = true
    let safetyTimeout: NodeJS.Timeout

    if (item.assets) {
      const resolved = getAssetPathAndMime(item.assets)
      if (resolved) {
        const { filePath, mimeType } = resolved

        if (
          mimeType !== 'application/x-widget-youtube' &&
          mimeType !== 'application/x-widget-remote-url' &&
          mimeType !== 'application/x-widget-html' &&
          mimeType !== 'application/x-widget-flow' &&
          (item.type === 'image' || item.type === 'video' || mimeType === 'image/png')
        ) {
          // Use cached blob if available, otherwise get a deduplicated signed URL
          const cached = cacheMap.current[filePath]
          if (!cached) {
            // Use the parent's deduplicating getter so concurrent PlayableItem renders
            // (active + preload) for the same asset don't fire two sign requests.
            getSignedUrl(filePath).then((url: string) => {
              if (mounted) setMediaUrl(url)
            }).catch(console.error)
          }
        }
      }

      // Safety timeout: if media takes too long to load, force start the timer (H-16)
      safetyTimeout = setTimeout(() => {
        if (mounted) setIsLoaded(true)
      }, 5000)
    }

    return () => {
      mounted = false
      if (safetyTimeout) clearTimeout(safetyTimeout)
    }
  }, [item, cacheMap, hardwareId, secret, getSignedUrl])

  useEffect(() => {
    if (isActive && isLoaded) {
      // Set a timer for duration_seconds only after media is loaded/can play (H-16)
      const timeoutId = setTimeout(() => {
        onComplete()
      }, item.duration_seconds * 1000)
      timerRef.current = timeoutId

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [isActive, isLoaded, item.duration_seconds, onComplete])

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

  if (item.type === 'widget') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <h2 style={{ color: 'white', fontFamily: 'sans-serif' }}>{item.widget_type || 'Widget'}</h2>
      </div>
    )
  }

  if (!mediaUrl) return null

  if (item.assets?.mime_type === 'application/x-widget-youtube') {
    const videoId = mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
    return (
      <iframe 
        src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0`}
        style={{ ...mediaStyle, border: 'none', pointerEvents: 'none' }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        onLoad={() => setIsLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
      />
    )
  }

  if (item.assets?.mime_type === 'application/x-widget-remote-url') {
    return (
      <iframe
        src={mediaUrl}
        style={{ ...mediaStyle, border: 'none' }}
        allow="autoplay; encrypted-media; fullscreen"
        onLoad={() => setIsLoaded(true)}
        sandbox="allow-scripts allow-forms allow-presentation"
      />
    )
  }

  if (item.assets?.mime_type === 'application/x-widget-html') {
    let parsedConfig: { html?: string; css?: string } | null = null
    try {
      parsedConfig = JSON.parse(mediaUrl)
    } catch (err) {
      console.error('Failed to parse custom html widget in playlist engine:', err)
    }

    if (!parsedConfig) {
      return (
        <div style={{ color: 'red', padding: '10px' }} ref={() => setIsLoaded(true)}>
          Error rendering custom HTML widget
        </div>
      )
    }

    const { html = '', css = '' } = parsedConfig
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
        title="widget-html-playlist"
        srcDoc={iframeSrcDoc}
        style={{ ...mediaStyle, border: 'none' }}
        onLoad={() => setIsLoaded(true)}
        sandbox=""
      />
    )
  }

  if (item.assets?.mime_type === 'application/x-widget-flow') {
    let parsedConfig: { style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'; showSeconds: boolean; showDate: boolean; use24Hour: boolean; dateFormat: string; theme?: 'light' | 'dark' } | null = null
    try {
      parsedConfig = JSON.parse(mediaUrl)
    } catch (err) {
      console.error('Failed to render Clock widget in playlist engine:', err)
    }

    if (!parsedConfig) {
      return (
        <div style={{ color: 'red', padding: '10px' }} ref={() => setIsLoaded(true)}>
          Error rendering Clock widget
        </div>
      )
    }

    return (
      <div style={{ width: '100%', height: '100%' }} ref={() => setIsLoaded(true)}>
        <FlowClockRenderer
          style={parsedConfig.style}
          showSeconds={parsedConfig.showSeconds}
          showDate={parsedConfig.showDate}
          use24Hour={parsedConfig.use24Hour}
          dateFormat={parsedConfig.dateFormat}
          theme={parsedConfig.theme}
        />
      </div>
    )
  }

  if (item.type === 'video' || item.assets?.mime_type?.startsWith('video/')) {
    return (
      <video
        src={mediaUrl}
        style={mediaStyle}
        autoPlay={isActive}
        muted={isMuted}
        playsInline
        loop
        preload="auto"
        onCanPlay={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
    )
  }

  return (
    <img
      src={mediaUrl}
      style={mediaStyle}
      alt="Playlist Item"
      onLoad={() => setIsLoaded(true)}
      onError={() => setIsLoaded(true)}
    />
  )
}
