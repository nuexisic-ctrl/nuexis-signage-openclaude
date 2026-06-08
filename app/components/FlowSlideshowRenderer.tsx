'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { getSignedMediaUrl } from '@/app/player/actions'

const STYLE_ID = 'flow-slideshow-styles-v1'

const GLOBAL_CSS = `
.fss-stage {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.fss-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--fss-bg-color, #000000);
}

.fss-slide-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
}

.fss-slide-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

/* Transitions */

/* Fade */
.fss-fade-out {
  animation: fss-fade-out-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.fss-fade-in {
  animation: fss-fade-in-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
@keyframes fss-fade-out-anim {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes fss-fade-in-anim {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Left */
.fss-slide-left-out {
  animation: fss-slide-left-out-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.fss-slide-left-in {
  animation: fss-slide-left-in-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
@keyframes fss-slide-left-out-anim {
  from { transform: translateX(0%); }
  to { transform: translateX(-100%); }
}
@keyframes fss-slide-left-in-anim {
  from { transform: translateX(100%); }
  to { transform: translateX(0%); }
}

/* Slide Right */
.fss-slide-right-out {
  animation: fss-slide-right-out-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.fss-slide-right-in {
  animation: fss-slide-right-in-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
@keyframes fss-slide-right-out-anim {
  from { transform: translateX(0%); }
  to { transform: translateX(100%); }
}
@keyframes fss-slide-right-in-anim {
  from { transform: translateX(-100%); }
  to { transform: translateX(0%); }
}

/* Zoom In */
.fss-zoom-in-out {
  animation: fss-zoom-in-out-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.fss-zoom-in-in {
  animation: fss-zoom-in-in-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
@keyframes fss-zoom-in-out-anim {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(1.08); opacity: 0; }
}
@keyframes fss-zoom-in-in-anim {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Zoom Out */
.fss-zoom-out-out {
  animation: fss-zoom-out-out-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.fss-zoom-out-in {
  animation: fss-zoom-out-in-anim 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
@keyframes fss-zoom-out-out-anim {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.92); opacity: 0; }
}
@keyframes fss-zoom-out-in-anim {
  from { transform: scale(1.08); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Preload hidden image */
.fss-preload {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0.01;
  overflow: hidden;
}
`

function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

export interface SlideshowImage {
  id: string
  file_name: string
  file_path: string
  url?: string
}

export interface FlowSlideshowRendererProps {
  images?: SlideshowImage[]
  animation?: 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'
  backgroundColor?: string
  duration?: number
  hardwareId?: string
  secret?: string
  getSignedUrl?: (filePath: string) => Promise<string>
}

export default function FlowSlideshowRenderer({
  images = [],
  animation = 'fade',
  backgroundColor = '#000000',
  duration = 5,
  hardwareId,
  secret,
  getSignedUrl,
}: FlowSlideshowRendererProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Ensure global styles are present
  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  // Resolve signed URLs for current and next slide
  const resolveUrlForIndex = useCallback(
    async (idx: number) => {
      const img = images[idx]
      if (!img) return

      // If pre-resolved (e.g. preview mode), use it
      if (img.url) {
        setResolvedUrls((prev) => ({ ...prev, [img.file_path]: img.url! }))
        return
      }

      if (resolvedUrls[img.file_path]) return

      try {
        let signedUrl = ''
        if (getSignedUrl) {
          signedUrl = await getSignedUrl(img.file_path)
        } else if (hardwareId && secret) {
          signedUrl = await getSignedMediaUrl(img.file_path, hardwareId, secret)
        }

        if (signedUrl) {
          setResolvedUrls((prev) => ({ ...prev, [img.file_path]: signedUrl }))
        }
      } catch (err) {
        console.error('Failed to resolve signed URL for slideshow slide:', img.file_path, err)
      }
    },
    [images, getSignedUrl, hardwareId, secret, resolvedUrls]
  )

  // Pre-resolve URLs dynamically as index changes
  useEffect(() => {
    if (images.length === 0) return

    const currImg = images[currentIndex]
    if (currImg && !resolvedUrls[currImg.file_path]) {
      resolveUrlForIndex(currentIndex)
    }

    const nextIdx = (currentIndex + 1) % images.length
    const nextImg = images[nextIdx]
    if (nextImg && !resolvedUrls[nextImg.file_path]) {
      resolveUrlForIndex(nextIdx)
    }

    // Also pre-resolve the index after next to keep buffer full
    const afterNextIdx = (currentIndex + 2) % images.length
    const afterNextImg = images[afterNextIdx]
    if (afterNextImg && !resolvedUrls[afterNextImg.file_path]) {
      resolveUrlForIndex(afterNextIdx)
    }
  }, [currentIndex, images, resolveUrlForIndex, resolvedUrls])

  // Slide loop timer
  useEffect(() => {
    if (images.length <= 1) {
      if (isTransitioning) {
        setIsTransitioning(false)
        setNextIndex(null)
      }
      return
    }

    const intervalMs = Math.max(1, duration) * 1000

    const tick = () => {
      const targetNextIndex = (currentIndex + 1) % images.length
      setNextIndex(targetNextIndex)
      setIsTransitioning(true)
    }

    timerRef.current = setTimeout(tick, intervalMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, images.length, duration, isTransitioning])

  // Complete transition after animation time (800ms matches CSS)
  useEffect(() => {
    if (!isTransitioning || nextIndex === null) return

    const transitionTimer = setTimeout(() => {
      setCurrentIndex(nextIndex)
      setNextIndex(null)
      setIsTransitioning(false)
    }, 800)

    return () => clearTimeout(transitionTimer)
  }, [isTransitioning, nextIndex])

  if (images.length === 0) {
    return (
      <div className="fss-stage">
        <div className="fss-container" style={{ '--fss-bg-color': backgroundColor } as React.CSSProperties}>
          <div style={{ color: '#666', fontFamily: 'sans-serif', fontSize: '1.2rem' }}>
            No images selected in slideshow
          </div>
        </div>
      </div>
    )
  }

  // Animation CSS mappings
  const getOutAnimationClass = () => {
    switch (animation) {
      case 'slide-left': return 'fss-slide-left-out'
      case 'slide-right': return 'fss-slide-right-out'
      case 'zoom-in': return 'fss-zoom-in-out'
      case 'zoom-out': return 'fss-zoom-out-out'
      default: return 'fss-fade-out'
    }
  }

  const getInAnimationClass = () => {
    switch (animation) {
      case 'slide-left': return 'fss-slide-left-in'
      case 'slide-right': return 'fss-slide-right-in'
      case 'zoom-in': return 'fss-zoom-in-in'
      case 'zoom-out': return 'fss-zoom-out-in'
      default: return 'fss-fade-in'
    }
  }

  const currentImage = images[currentIndex]
  const currentUrl = currentImage ? resolvedUrls[currentImage.file_path] : ''

  const nextImage = nextIndex !== null ? images[nextIndex] : null
  const nextUrl = nextImage ? resolvedUrls[nextImage.file_path] : ''

  // Preload buffer: find next-next image to preload
  const preloadIdx = (currentIndex + 1) % images.length
  const preloadImage = images[preloadIdx]
  const preloadUrl = preloadImage ? resolvedUrls[preloadImage.file_path] : ''

  return (
    <div className="fss-stage">
      <div className="fss-container" style={{ '--fss-bg-color': backgroundColor } as React.CSSProperties}>
        {/* Render outgoing slide */}
        {currentUrl && (
          <div className={`fss-slide-wrapper ${isTransitioning ? getOutAnimationClass() : ''}`}>
            <img src={currentUrl} className="fss-slide-img" alt={currentImage?.file_name} />
          </div>
        )}

        {/* Render incoming slide only during transitions */}
        {isTransitioning && nextUrl && (
          <div className={`fss-slide-wrapper ${getInAnimationClass()}`}>
            <img src={nextUrl} className="fss-slide-img" alt={nextImage?.file_name} />
          </div>
        )}

        {/* Background preloader for upcoming slide */}
        {preloadUrl && preloadUrl !== currentUrl && preloadUrl !== nextUrl && (
          <img src={preloadUrl} className="fss-preload" alt="preload" />
        )}
      </div>
    </div>
  )
}
