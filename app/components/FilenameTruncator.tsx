'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './filename-truncator.module.css'

interface FilenameTruncatorProps {
  filename: string
  className?: string
  suffixLength?: number // characters of base name to keep at the end
  maxWidth?: string
}

export function FilenameTruncator({
  filename,
  className = '',
  suffixLength = 6,
  maxWidth = '100%',
}: FilenameTruncatorProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2,
      })
    }
  }

  const handleMouseEnter = () => {
    updateCoords()
    setShowTooltip(true)
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    updateCoords()
    setShowTooltip(prev => !prev)
  }

  // Close tooltip on click/touch outside
  useEffect(() => {
    if (!showTooltip) return
    const handleOutsideClick = () => {
      setShowTooltip(false)
    }
    window.addEventListener('click', handleOutsideClick)
    window.addEventListener('touchend', handleOutsideClick)
    return () => {
      window.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('touchend', handleOutsideClick)
    }
  }, [showTooltip])

  if (!filename) return null

  // Separate base name and extension
  const lastDotIndex = filename.lastIndexOf('.')
  let baseName = filename
  let extension = ''
  
  if (lastDotIndex !== -1 && lastDotIndex > 0) {
    baseName = filename.substring(0, lastDotIndex)
    extension = filename.substring(lastDotIndex)
  }

  // Determine suffix length based on baseName size
  let actualSuffixLength = suffixLength
  if (baseName.length <= suffixLength + 4) {
    actualSuffixLength = Math.max(1, Math.floor(baseName.length / 2))
  }

  const part1 = baseName.substring(0, baseName.length - actualSuffixLength)
  const part2 = baseName.substring(baseName.length - actualSuffixLength) + extension

  const tooltipContent = showTooltip && isMounted && typeof document !== 'undefined' ? (
    createPortal(
      <div
        className={styles.tooltip}
        style={{
          position: 'absolute',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transform: 'translate(-50%, -100%)',
          zIndex: 99999,
          pointerEvents: 'none',
        }}
        role="tooltip"
      >
        {filename}
        <div className={styles.tooltipArrow} />
      </div>,
      document.body
    )
  ) : null

  return (
    <>
      <span
        ref={triggerRef}
        className={`${styles.container} ${className}`}
        style={{ maxWidth }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        aria-label={filename}
      >
        <span className={part1 ? styles.part1 : ''}>{part1 || filename}</span>
        {part1 && <span className={styles.part2}>{part2}</span>}
      </span>
      {tooltipContent}
    </>
  )
}

export default FilenameTruncator
