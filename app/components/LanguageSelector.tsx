'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useTranslation, SUPPORTED_LOCALES, type LocaleType } from '@/lib/i18n'
import styles from './LanguageSelector.module.css'

interface LanguageSelectorProps {
  align?: 'left' | 'right'
  className?: string
}

export default function LanguageSelector({ align = 'right', className = '' }: LanguageSelectorProps) {
  const { locale, setLocale } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 180 })

  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      // Position below the button
      const dropdownWidth = 180
      const leftPos = align === 'right' 
        ? rect.right - dropdownWidth + window.scrollX 
        : rect.left + window.scrollX

      setCoords({
        top: rect.bottom + 4 + window.scrollY,
        left: Math.max(8, leftPos), // Prevent off-screen left
        width: dropdownWidth
      })
    }
  }, [align])

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

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target as Node))
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Accessibility keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const currentLanguage = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0]

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Change Language"
      >
        <Globe size={18} className={styles.globeIcon} />
        <span className={styles.label}>{currentLanguage.nativeLabel}</span>
        <ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          role="listbox"
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999
          }}
        >
          <div className={styles.optionsList}>
            {SUPPORTED_LOCALES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`${styles.optionBtn} ${lang.code === locale ? styles.optionActive : ''}`}
                onClick={() => {
                  setLocale(lang.code)
                  setIsOpen(false)
                }}
                role="option"
                aria-selected={lang.code === locale}
              >
                <span className={styles.optionText}>{lang.nativeLabel}</span>
                {lang.code === locale && (
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
