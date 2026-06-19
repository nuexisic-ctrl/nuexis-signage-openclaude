'use client'

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import styles from './Modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
  className?: string
  style?: React.CSSProperties
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '480px',
  className = '',
  style,
}: ModalProps) {
  const { t } = useTranslation()
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      
      const getFocusables = () => {
        if (!modalRef.current) return []
        return Array.from(
          modalRef.current.querySelectorAll(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"], [contenteditable]'
          )
        ) as HTMLElement[]
      }

      // Small timeout to allow input autoFocus to execute first if present
      const timer = setTimeout(() => {
        const focusables = getFocusables()
        const autoFocused = modalRef.current?.querySelector('[autofocus], [autoFocus]') as HTMLElement
        if (autoFocused) {
          autoFocused.focus()
        } else if (focusables.length > 0) {
          focusables[0].focus()
        }
      }, 50)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
          return
        }

        if (e.key === 'Tab') {
          const focusables = getFocusables()
          if (focusables.length === 0) return

          const firstEl = focusables[0]
          const lastEl = focusables[focusables.length - 1]

          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              e.preventDefault()
              lastEl.focus()
            }
          } else {
            if (document.activeElement === lastEl) {
              e.preventDefault()
              firstEl.focus()
            }
          }
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('keydown', handleKeyDown)
        
        // Restore focus on close
        if (previousActiveElement.current) {
          previousActiveElement.current.focus()
        }
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  return (
    <div 
      className={styles.modalOverlay} 
      ref={overlayRef} 
      onClick={handleOverlayClick}
      style={style}
    >
      <div 
        className={`${styles.modalContainer} ${className}`} 
        ref={modalRef}
        role="dialog" 
        aria-modal="true"
        aria-labelledby="shared-modal-title"
        style={{ maxWidth }}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleArea}>
            <h2 id="shared-modal-title" className={styles.modalTitle}>{title}</h2>
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
          <button 
            type="button" 
            className={styles.modalCloseBtn} 
            onClick={onClose} 
            aria-label={t('Close')}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
