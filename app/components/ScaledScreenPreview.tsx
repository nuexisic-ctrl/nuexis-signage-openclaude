'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type ScreenMode = 'landscape' | 'portrait'

function getVirtualDimensions(mode: ScreenMode) {
  // Use real signage-native resolutions so the preview is a true miniature of production.
  // (We scale down with CSS transforms; content should never clip.)
  return mode === 'landscape'
    ? { w: 1920, h: 1080 } // 16:9
    : { w: 1080, h: 1920 } // 9:16
}

export default function ScaledScreenPreview({
  mode,
  className,
  style,
  children,
}: {
  mode: ScreenMode
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const cr = entry.contentRect
      setContainerSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const virtual = useMemo(() => getVirtualDimensions(mode), [mode])
  const scale = useMemo(() => {
    if (!containerSize.w || !containerSize.h) return 0
    return Math.min(containerSize.w / virtual.w, containerSize.h / virtual.h)
  }, [containerSize, virtual])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          width: virtual.w,
          height: virtual.h,
          transform: scale ? `scale(${scale})` : 'scale(0)',
          transformOrigin: 'center center',
          // Keep the scaled content centered inside the container:
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(virtual.w / 2),
          marginTop: -(virtual.h / 2),
        }}
      >
        {children}
      </div>
    </div>
  )
}

