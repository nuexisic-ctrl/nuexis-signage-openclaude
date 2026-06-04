'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { modalStack } from '@/lib/utils/modalStack'
import styles from './ThemeSelect.module.css'

type ThemeValue = 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'

interface ThemeOption {
  value: ThemeValue
  label: string
}

interface ThemeSelectProps {
  value: ThemeValue
  onChange: (value: ThemeValue) => void
  options: ReadonlyArray<ThemeOption>
  id: string
  onPreviewChange?: (value: ThemeValue | null) => void
  previewDelay?: number
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
}

function ThemeColorDot({
  theme,
  primaryColor,
  backgroundColor
}: {
  theme: ThemeValue
  primaryColor?: string
  backgroundColor?: string
}) {
  let bg = backgroundColor || '#090d16'
  let p = primaryColor || '#38bdf8'

  if (theme === 'dark') {
    bg = '#090d16'
    p = '#38bdf8'
  } else if (theme === 'light') {
    bg = '#f8fafc'
    p = '#4f46e5'
  } else if (theme === 'sunset') {
    bg = '#e11d48'
    p = '#fca5a5'
  } else if (theme === 'neon') {
    bg = '#000000'
    p = '#00f0ff'
  } else if (theme === 'ocean') {
    bg = '#0f172a'
    p = '#22d3ee'
  }

  return (
    <div 
      className={styles.colorDotContainer}
      style={{ background: bg }}
    >
      <div 
        className={styles.colorDotInner} 
        style={{ background: p }} 
      />
    </div>
  )
}

export default function ThemeSelect({
  value,
  onChange,
  options,
  id,
  onPreviewChange,
  previewDelay = 200,
  primaryColor,
  secondaryColor,
  backgroundColor
}: ThemeSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const selectedOption = options.find(opt => opt.value === value)

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
    }
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [isOpen, updateCoords])

  const onPreviewChangeRef = useRef(onPreviewChange)
  useEffect(() => {
    onPreviewChangeRef.current = onPreviewChange
  }, [onPreviewChange])

  const clearPreviewTimer = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  const closeDropdown = useCallback(() => {
    clearPreviewTimer()
    onPreviewChangeRef.current?.(null)
    setIsOpen(false)
  }, [clearPreviewTimer])

  // Register with modalStack when open
  useEffect(() => {
    const stackId = `theme-select-${id}`
    if (isOpen) {
      modalStack.push(stackId)
    } else {
      modalStack.pop(stackId)
    }
    return () => {
      modalStack.pop(stackId)
    }
  }, [isOpen, id])

  useEffect(() => {
    return () => {
      clearPreviewTimer()
      onPreviewChangeRef.current?.(null)
    }
  }, [clearPreviewTimer])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        (!optionsRef.current || !optionsRef.current.contains(e.target as Node))
      ) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, closeDropdown])

  const handleSelect = (val: ThemeValue) => {
    clearPreviewTimer()
    onPreviewChangeRef.current?.(null)
    onChange(val)
    setIsOpen(false)
  }

  const previewOption = (val: ThemeValue | null) => {
    clearPreviewTimer()
    if (!onPreviewChangeRef.current) return
    hoverTimeoutRef.current = window.setTimeout(() => {
      onPreviewChangeRef.current?.(val)
    }, previewDelay)
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={() => {
          if (isOpen) {
            closeDropdown()
          } else {
            setIsOpen(true)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <ThemeColorDot 
            theme={value} 
            primaryColor={primaryColor}
            backgroundColor={backgroundColor}
          />
          <span className={styles.valueText}>
            {selectedOption ? selectedOption.label : 'Select Theme...'}
          </span>
        </div>
        <ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={optionsRef} 
          className={styles.popoverMenu} 
          role="listbox" 
          data-dropdown={`theme-select-${id}`}
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
        >
          <div className={styles.optionsList}>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.optionBtn} ${opt.value === value ? styles.optionActive : ''}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => previewOption(opt.value)}
                onMouseLeave={() => previewOption(null)}
                role="option"
                aria-selected={opt.value === value}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <ThemeColorDot 
                    theme={opt.value} 
                    primaryColor={opt.value === 'custom' ? primaryColor : undefined}
                    backgroundColor={opt.value === 'custom' ? backgroundColor : undefined}
                  />
                  <span className={styles.optionLabel}>{opt.label}</span>
                </div>
                {opt.value === value && (
                  <Check size={14} className={styles.checkIcon} />
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
