'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className={`${styles.icon} ${styles.iconDanger}`} size={24} />
      case 'warning':
        return <AlertTriangle className={`${styles.icon} ${styles.iconWarning}`} size={24} />
      default:
        return <Info className={`${styles.icon} ${styles.iconInfo}`} size={24} />
    }
  }

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return `${styles.btn} ${styles.btnDanger}`
      case 'warning':
        return `${styles.btn} ${styles.btnWarning}`
      default:
        return `${styles.btn} ${styles.btnPrimary}`
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div 
        ref={dialogRef}
        className={styles.modal} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <button 
          className={styles.closeBtn} 
          onClick={onClose} 
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.iconContainer}>
              {getIcon()}
            </div>
            <h3 id="confirm-dialog-title" className={styles.title}>
              {title}
            </h3>
          </div>
          
          <p id="confirm-dialog-desc" className={styles.description}>
            {description}
          </p>
        </div>

        <div className={styles.actions}>
          <button 
            type="button" 
            className={`${styles.btn} ${styles.btnCancel}`} 
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button 
            type="button" 
            className={getConfirmButtonClass()} 
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
