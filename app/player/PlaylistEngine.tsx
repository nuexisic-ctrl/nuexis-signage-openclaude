'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getPlaylistItems, getSignedMediaUrl } from './actions'

interface PlaylistItem {
  id: string
  playlist_id: string | null
  type: string
  asset_id: string | null
  widget_type: string | null
  widget_config: any
  duration_seconds: number
  sort_order: number
  assets?: {
    file_path: string
    mime_type: string
  } | null
}

export default function PlaylistEngine({ 
  playlistId, 
  supabase, 
  scaleMode, 
  isMuted 
}: { 
  playlistId: string
  supabase: any
  scaleMode: string
  isMuted: boolean
}) {
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Use a map to store cached blob URLs
  const cacheMap = useRef<Record<string, string>>({})

  useEffect(() => {
    let mounted = true

    const fetchItems = async (showLoading = true) => {
      if (showLoading && mounted) setIsLoading(true)
      const data = await getPlaylistItems(playlistId)
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

    setIsLoading(true)
    fetchItems(true)

    // Realtime listener for broadcast refresh signals
    const channel = supabase
      .channel(`playlist-broadcast-${playlistId}`)
      .on(
        'broadcast',
        { event: 'refresh' },
        () => {
          console.log('[PlaylistEngine] Broadcast refresh received. Performing professional refresh...')
          
          // Professional hard-refresh: fade out the screen before reloading to prevent jarring cuts
          document.body.style.transition = 'opacity 0.5s ease-out'
          document.body.style.opacity = '0'
          
          setTimeout(() => {
            fetchItems(true)
            document.body.style.opacity = '1'
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
    }
  }, [playlistId, supabase])

  const cacheAssets = async (playlistItems: PlaylistItem[]) => {
    try {
      const cache = await caches.open('nuexis-playlist-cache')
      for (const item of playlistItems) {
        if ((item.type === 'image' || item.type === 'video') && item.assets) {
          // Skip widget types
          if (item.assets.mime_type.startsWith('application/x-widget')) continue
          
          // Get a signed URL from the private bucket
          const url = await getSignedMediaUrl(item.assets.file_path)
          
          let response = await cache.match(url)
          if (!response) {
            response = await fetch(url, { mode: 'cors' })
            if (response.ok) {
              await cache.put(url, response.clone())
            }
          }
          
          if (response && response.ok && !cacheMap.current[item.assets.file_path]) {
            const blob = await response.blob()
            cacheMap.current[item.assets.file_path] = URL.createObjectURL(blob)
          }
        }
      }
    } catch (err) {
      console.error('[PlaylistEngine] Failed to cache assets:', err)
    }
  }

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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Background/Next item (Preloading) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, opacity: 0 }}>
        {items.length > 1 && (
           <PlayableItem 
             key={`preload-${nextItem.id}-${nextIndex}`} 
             item={nextItem} 
             supabase={supabase} 
             scaleMode={scaleMode} 
             isMuted={isMuted} 
             cacheMap={cacheMap.current}
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
          supabase={supabase} 
          scaleMode={scaleMode} 
          isMuted={isMuted} 
          cacheMap={cacheMap.current}
          onComplete={handleNext}
          isActive={true}
        />
      </div>
    </div>
  )
}

function PlayableItem({ item, supabase, scaleMode, isMuted, cacheMap, onComplete, isActive }: any) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  
  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    if (item.assets) {
      if (item.assets.mime_type === 'application/x-widget-youtube' || item.assets.mime_type === 'application/x-widget-remote-url') {
        if (mounted) setMediaUrl(item.assets.file_path)
      } else if (item.type === 'image' || item.type === 'video') {
        // Use cached blob if available, otherwise get a signed URL
        const cached = cacheMap[item.assets.file_path]
        if (cached) {
          if (mounted) setMediaUrl(cached)
        } else {
          getSignedMediaUrl(item.assets.file_path).then(url => {
            if (mounted) setMediaUrl(url)
          }).catch(console.error)
        }
      }
    }

    if (isActive) {
      // Set a timer for duration_seconds
      timeoutId = setTimeout(() => {
        onComplete()
      }, item.duration_seconds * 1000)
    }

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [item, supabase, onComplete, isActive, cacheMap])

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
      />
    )
  }

  if (item.assets?.mime_type === 'application/x-widget-remote-url') {
    return (
      <iframe
        src={mediaUrl}
        style={{ ...mediaStyle, border: 'none' }}
        allow="autoplay; encrypted-media; fullscreen"
      />
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
      />
    )
  }

  return (
    <img
      src={mediaUrl}
      style={mediaStyle}
      alt="Playlist Item"
    />
  )
}
