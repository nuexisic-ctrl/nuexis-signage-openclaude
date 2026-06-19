'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { AlertTriangle, X, Check } from 'lucide-react'
import { deleteAsset, updateAssetName, updateAssetFolder } from './actions'
import styles from './Modal.module.css'
import { toast } from '@/app/components/Toast'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'

import { PRESET_COLORS } from '@/lib/utils/constants'

export function RenameAssetModal({
  currentName,
  teamSlug,
  assetId,
  mimeType,
  currentColor,
  onClose,
  onSuccess,
}: {
  currentName: string
  teamSlug: string
  assetId: string
  mimeType?: string
  currentColor?: string | null
  onClose: () => void
  onSuccess: (newName: string, newColor?: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [color, setColor] = useState(currentColor || '#78716c')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isPending, startTransition] = useTransition()

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const isFolder = mimeType === 'application/x-folder'

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('Name cannot be empty.'))
      return
    }
    
    if (!isFolder && trimmed === currentName) {
      onClose()
      return
    }
    if (isFolder && trimmed === currentName && color.toLowerCase() === (currentColor || '#78716c').toLowerCase()) {
      onClose()
      return
    }

    startTransition(async () => {
      if (isFolder) {
        const result = await updateAssetFolder(teamSlug, assetId, trimmed, color)
        if (result.success) {
          toast.success(t('Folder renamed successfully'))
          onSuccess(trimmed, color)
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await updateAssetName(teamSlug, assetId, trimmed)
        if (result.success) {
          toast.success(t('Asset renamed successfully'))
          onSuccess(trimmed)
        } else {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isFolder ? t('Rename Folder') : t('Rename Asset')}
      maxWidth="400px"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label htmlFor="rename-asset-input" className={styles.label}>
            {isFolder ? t('Folder Name') : t('Asset Name')}
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            <input
              id="rename-asset-input"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isFolder ? t('e.g. Campaign 2026, Menu Slides') : t('e.g. Lobby Image, Promo Video')}
              className={styles.input}
              autoFocus
            />
            {isFolder && (
              <>
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
                        aria-label={t('Close color picker')}
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
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            className={styles.submitBtn}
            style={{ background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
            onClick={onClose}
            disabled={isPending}
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending || !name.trim() || (isFolder ? (name.trim() === currentName && color.toLowerCase() === (currentColor || '#78716c').toLowerCase()) : name.trim() === currentName)}
          >
            {isPending ? t('Saving…') : t('Save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function DeleteAssetModal({
  assetId,
  assetName,
  filePath,
  teamSlug,
  isFolder = false,
  nestedCount = 0,
  onClose,
  onSuccess,
}: {
  assetId: string
  assetName: string
  filePath: string
  teamSlug: string
  isFolder?: boolean
  nestedCount?: number
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAsset(teamSlug, assetId, filePath)
      if (result.success) {
        toast.success(isFolder ? t('Folder "{name}" deleted successfully', { name: assetName }) : t('Asset "{name}" deleted successfully', { name: assetName }))
        onSuccess(assetId)
      } else {
        toast.error(result.error || (isFolder ? t('Failed to delete folder') : t('Failed to delete asset')))
      }
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isFolder ? t('Delete Folder') : t('Delete Asset')}
      maxWidth="400px"
    >
      <div className={styles.form}>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
          {isFolder 
            ? t('Are you sure you want to delete folder "{name}"?', { name: assetName })
            : t('Are you sure you want to delete "{name}"?', { name: assetName })
          }
        </p>
        
        {isFolder ? (
          <p style={{ fontSize: '0.88rem', color: 'var(--on-surface)', marginBottom: '24px', lineHeight: '1.5' }}>
            {nestedCount > 0 
              ? t('Deleting this folder will move its {count} nested item(s) to the root directory. Screens displaying these items will continue to display them from the root.', { count: String(nestedCount) })
              : t('This folder is empty. Deleting it will permanently remove it from your library.')
            }
          </p>
        ) : (
          <p style={{ fontSize: '0.88rem', color: 'var(--on-surface)', marginBottom: '24px', lineHeight: '1.5' }}>
            {t('This action will permanently remove the asset from your library. Any screens currently displaying this asset will stop showing it.')}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            className={styles.submitBtn}
            style={{ background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
            onClick={onClose} 
            disabled={isPending}
          >
            {t('Cancel')}
          </button>
          <button 
            type="button"
            className={styles.submitBtn}
            style={{ background: 'var(--error)', color: 'var(--on-primary)', border: 'none' }}
            onClick={handleConfirm} 
            disabled={isPending}
          >
            {isPending ? t('Deleting…') : (isFolder ? t('Delete Folder') : t('Delete Asset'))}
          </button>
        </div>
      </div>
    </Modal>
  )
}
