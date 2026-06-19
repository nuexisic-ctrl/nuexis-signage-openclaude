'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Check, AlertTriangle, X } from 'lucide-react'
import { createFolder } from './actions'
import { useTranslation } from '@/lib/i18n'
import styles from './Modal.module.css'
import { modalStack } from '@/lib/utils/modalStack'
import Modal from '../components/Modal'
import { PRESET_COLORS } from '@/lib/utils/constants'

export function CreateFolderModal({
  teamSlug,
  onClose,
  onSuccess,
  parentFolderId,
  overlayStyle,
}: {
  teamSlug: string
  onClose: () => void
  onSuccess: (id: string, name: string, color: string) => void
  parentFolderId?: string | null
  overlayStyle?: React.CSSProperties
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#000000')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  const colorPickerRef = useRef<HTMLDivElement>(null)

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
        onSuccess(result.id, trimmed, color)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('New Folder')}
      style={overlayStyle}
      maxWidth="400px"
    >
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
    </Modal>
  )
}
