import { useState, useRef, useTransition, useEffect } from 'react'
import { AlertTriangle, X, Check } from 'lucide-react'
import { deleteAsset, updateAssetName, updateAssetFolder } from './actions'
import styles from './Modal.module.css'
import { toast } from '@/app/components/Toast'

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
      toast.error('Name cannot be empty.')
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
          toast.success('Folder renamed successfully')
          onSuccess(trimmed, color)
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await updateAssetName(teamSlug, assetId, trimmed)
        if (result.success) {
          toast.success('Asset renamed successfully')
          onSuccess(trimmed)
        } else {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
            {isFolder ? 'Rename Folder' : 'Rename Asset'}
          </h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>
              {isFolder ? 'Folder Name' : 'Asset Name'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Lobby Image, Promo Video"
                style={{
                  width: '100%',
                  padding: isFolder ? '10px 46px 10px 14px' : '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  background: 'var(--surface-lowest)',
                  color: 'var(--on-surface)',
                  fontSize: '0.875rem'
                }}
                autoFocus
              />
              {isFolder && (
                <>
                  <button
                    type="button"
                    className={styles.colorIndicatorDot}
                    style={{ backgroundColor: color, position: 'absolute', right: '12px' }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    title="Select Folder Color"
                    aria-label="Select Folder Color"
                  />
                  {showColorPicker && (
                    <div className={styles.colorPickerPopover} ref={colorPickerRef} style={{ top: 'calc(100% + 8px)' }}>
                      <div className={styles.popoverHeader}>
                        <span className={styles.popoverTitle}>Select Color</span>
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
                            >
                              {isSelected && <Check size={10} style={{ color: c === '#ffffff' ? '#000' : '#fff' }} />}
                            </button>
                          )
                        })}
                      </div>
                      
                      <div className={styles.customColorSection}>
                        <label className={styles.customColorLabel}>Custom Color</label>
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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim() || (isFolder ? (name.trim() === currentName && color.toLowerCase() === (currentColor || '#78716c').toLowerCase()) : name.trim() === currentName)}
              style={{
                padding: '10px 16px', background: 'var(--primary)', color: 'var(--on-primary)',
                border: 'none', borderRadius: '8px', cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-label)', opacity: isPending ? 0.7 : 1
              }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteAssetModal({
  assetId,
  assetName,
  filePath,
  teamSlug,
  onClose,
  onSuccess,
}: {
  assetId: string
  assetName: string
  filePath: string
  teamSlug: string
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteAsset(teamSlug, assetId, filePath)
      if (result.success) {
        toast.success(`Asset "${assetName}" deleted successfully`)
        onSuccess(assetId)
      } else {
        toast.error(result.error || 'Failed to delete asset')
      }
    })
  }

  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modalContainer} role="dialog" style={{ maxWidth: '400px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--error)' }}>Delete Asset</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
              Are you sure you want to delete <strong>{assetName}</strong>?
            </p>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={18} /></button>
        </div>
        
        <p style={{ fontSize: '0.88rem', color: 'var(--on-surface)', marginBottom: '24px', lineHeight: '1.5' }}>
          This action will permanently remove the asset from your library. Any screens currently displaying this asset will stop showing it.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ padding: '10px 16px', background: 'var(--surface-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)' }} 
            onClick={onClose} 
            disabled={isPending}
          >
            Cancel
          </button>
          <button 
            style={{ padding: '10px 16px', background: 'var(--error)', color: 'var(--on-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-label)' }} 
            onClick={handleConfirm} 
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}
