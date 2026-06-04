'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import { createFolder } from './actions'
import { t } from '@/lib/i18n'
import styles from './Modal.module.css'
import { modalStack } from '@/lib/utils/modalStack'
import { useA11yModal } from '@/lib/utils/useA11yModal'

const PRESET_COLORS = [
  '#78716c', // stone (default gray)
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#10b981', // emerald
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#737373', // neutral
  '#64748b', // slate
  '#000000', // black
]

export function CreateFolderModal({
  teamSlug,
  onClose,
  onSuccess,
  parentFolderId,
}: {
  teamSlug: string
  onClose: () => void
  onSuccess: (id: string) => void
  parentFolderId?: string | null
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#78716c')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useA11yModal({
    id: 'create-folder-modal',
    onClose,
    initialFocusSelector: 'input[name="folder-name"]',
  })

  // Handle click outside for color picker popover
  useEffect(() => {
    if (!showColorPicker) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showColorPicker])

  // Register the color picker as a "child" modal so ESC closes it before closing the modal.
  useEffect(() => {
    if (showColorPicker) {
      modalStack.push('create-folder-color-picker')
    } else {
      modalStack.pop('create-folder-color-picker')
    }
    return () => modalStack.pop('create-folder-color-picker')
  }, [showColorPicker])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('Folder name cannot be empty.'))
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createFolder(teamSlug, trimmed, color, parentFolderId)
      if (result.success) {
        onSuccess(result.id)
      } else {
        setError(result.error)
      }
    })
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={handleOverlayClick} role="presentation">
      <div 
        className={styles.modalContainer} 
        style={{ padding: '24px', maxWidth: '400px', width: '100%', overflow: 'visible' }} 
        onClick={e => e.stopPropagation()}
        ref={dialogRef as any}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-folder-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2
            id="create-folder-title"
            style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}
          >
            {t('New Folder')}
          </h2>
          <button
            onClick={onClose}
            className={styles.modalCloseBtn}
            aria-label="Close modal"
            type="button"
            data-modal-close="true"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div>
            <label
              htmlFor="create-folder-name"
              style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}
            >
              {t('Folder Name')}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                id="create-folder-name"
                name="folder-name"
                required
                maxLength={60}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('e.g. Campaign 2026, Menu Slides')}
                style={{ 
                  width: '100%', 
                  padding: '10px 46px 10px 14px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--outline-variant)', 
                  background: 'var(--surface-lowest)', 
                  color: 'var(--on-surface)',
                  fontSize: '0.875rem'
                }}
                autoFocus
              />
              <button
                type="button"
                className={styles.colorIndicatorDot}
                style={{ backgroundColor: color, position: 'absolute', right: '12px' }}
                onClick={() => setShowColorPicker(!showColorPicker)}
                title={t('Select Folder Color')}
                aria-label={t('Select Folder Color')}
              />
              
              {showColorPicker && (
                <div className={styles.colorPickerPopover} ref={colorPickerRef} style={{ top: 'calc(100% + 8px)' }}>
                  <div className={styles.popoverHeader}>
                    <span className={styles.popoverTitle}>{t('Select Color')}</span>
                    <button 
                      type="button" 
                      className={styles.popoverCloseBtn} 
                      onClick={() => setShowColorPicker(false)}
                      aria-label="Close color picker"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  
                  <div className={styles.predefinedColorsGrid}>
                    {PRESET_COLORS.map((c) => {
                      const isSelected = color.toLowerCase() === c.toLowerCase()
                      return (
                        <button
                          type="button"
                          key={c}
                          className={`${styles.colorOptionBubble} ${isSelected ? styles.colorOptionBubbleSelected : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setColor(c)}
                          aria-label={`${t('Select color')} ${c}`}
                        >
                          {isSelected && <Check size={10} style={{ color: c === '#ffffff' ? '#000' : '#fff' }} />}
                        </button>
                      )
                    })}
                  </div>
                  
                  <div className={styles.customColorSection}>
                    <label className={styles.customColorLabel}>{t('Custom Color')}</label>
                    <div className={styles.customColorRow}>
                      <input
                        type="color"
                        className={styles.customColorInput}
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                      <input
                        type="text"
                        className={styles.customColorHexInput}
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '10px 16px', background: 'var(--surface-low)', color: 'var(--on-surface)',
                border: '1px solid var(--outline-variant)', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              style={{
                padding: '10px 16px', background: 'var(--primary)', color: 'var(--on-primary)',
                border: 'none', borderRadius: '8px', cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              {isPending ? t('Creating…') : t('Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
