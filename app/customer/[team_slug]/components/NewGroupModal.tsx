'use client'

import React, { useState, useRef, useTransition, useEffect } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import { createGroup, updateGroupMembers } from '../groups/actions'
import styles from './NewGroupModal.module.css'
import { Device } from '../screens/types'
import { useTranslation } from '@/lib/i18n'

interface NewGroupModalProps {
  isOpen: boolean
  onClose: () => void
  teamSlug: string
  devices?: Device[]
  initialSelectedDeviceIds?: string[]
  onSuccess: (groupId: string) => void
}

const PRESET_COLORS = [
  '#000000', // black
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
  '#737373', // neutral
  '#525252', // neutral-dark
  '#64748b', // slate
  '#475569', // slate-dark
  '#334155', // slate-deep
]

export default function NewGroupModal({
  isOpen,
  onClose,
  teamSlug,
  devices = [],
  initialSelectedDeviceIds = [],
  onSuccess,
}: NewGroupModalProps) {
  const { t } = useTranslation()
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(PRESET_COLORS[0])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(initialSelectedDeviceIds)
  const [screenSearch, setScreenSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  
  const startedOnOverlayRef = useRef(false)
  const childWasActiveRef = useRef(false)

  // Close color picker popover on outside click
  useEffect(() => {
    if (!showColorPicker) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setTimeout(() => {
          setShowColorPicker(false)
        }, 120)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showColorPicker])
  
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) {
      startedOnOverlayRef.current = true
      childWasActiveRef.current = showColorPicker
    } else {
      startedOnOverlayRef.current = false
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && startedOnOverlayRef.current) {
      if (showColorPicker) {
        setShowColorPicker(false)
        return
      }
      if (childWasActiveRef.current) {
        childWasActiveRef.current = false
        return
      }
      onClose()
    }
  }

  const handleToggleScreen = (id: string) => {
    setSelectedDeviceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const result = await createGroup(teamSlug, groupName, groupColor)
      if (result.success && result.groupId) {
        if (selectedDeviceIds.length > 0) {
          const syncRes = await updateGroupMembers(teamSlug, result.groupId, selectedDeviceIds)
          if (!syncRes.success) {
            setErrorMsg(syncRes.error || t('Group created, but failed to assign selected screens.'))
            return
          }
        }
        setGroupName('')
        setGroupColor(PRESET_COLORS[0])
        setSelectedDeviceIds([])
        onSuccess(result.groupId)
      } else {
        setErrorMsg(result.error || t('Failed to create group.'))
      }
    })
  }

  const filteredDevices = devices.filter(d => 
    (d.name || '').toLowerCase().includes(screenSearch.toLowerCase())
  )

  return (
    <div 
      className={styles.overlay} 
      ref={overlayRef} 
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} role="dialog">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{t('New Screen Group')}</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label={t('Close modal')}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('Group Name (Optional)')}</label>
            <div className={styles.inputWithColorContainer}>
              <input
                type="text"
                maxLength={60}
                className={styles.inputWithColor}
                placeholder={t('E.g., Airport Terminal, Retail Front')}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isPending}
              />
              <button
                type="button"
                className={styles.colorIndicatorDot}
                style={{ backgroundColor: groupColor }}
                onClick={() => setShowColorPicker(!showColorPicker)}
                title={t('Select Group Color')}
                aria-label={t('Select Group Color')}
              />
              {showColorPicker && (
                <div className={styles.colorPickerPopover} ref={colorPickerRef}>
                  <div className={styles.popoverHeader}>
                    <span className={styles.popoverTitle}>{t('Select Color')}</span>
                    <button 
                      type="button" 
                      className={styles.popoverCloseBtn} 
                      onClick={() => setShowColorPicker(false)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  
                  <div className={styles.predefinedColorsGrid}>
                    {PRESET_COLORS.map((c) => {
                      const isSelected = groupColor === c
                      return (
                        <button
                          type="button"
                          key={c}
                          className={`${styles.colorOptionBubble} ${isSelected ? styles.colorOptionBubbleSelected : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setGroupColor(c)
                            setShowColorPicker(false)
                          }}
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
                        value={groupColor}
                        onChange={(e) => setGroupColor(e.target.value)}
                      />
                      <input
                        type="text"
                        className={styles.customColorHexInput}
                        value={groupColor}
                        onChange={(e) => setGroupColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screen selection checklist */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('Select Screens')}</label>
            <input 
              type="text" 
              className={styles.input} 
              style={{ minHeight: '38px', marginBottom: '6px' }}
              placeholder={t('Search screens...')} 
              value={screenSearch} 
              onChange={(e) => setScreenSearch(e.target.value)} 
            />
            {devices.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-subtle)', fontStyle: 'italic', margin: '4px 0' }}>
                {t('No screens available to assign.')}
              </p>
            ) : (
              <div className={styles.deviceList}>
                {filteredDevices.map(device => {
                  const checked = selectedDeviceIds.includes(device.id)
                  return (
                    <label key={device.id} className={styles.deviceItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleScreen(device.id)}
                      />
                      <span className={styles.deviceItemText}>
                        {device.name || 'Unnamed Screen'}
                      </span>
                      <span 
                        className={`${styles.deviceItemStatus} ${device.status === 'online' ? styles.deviceItemStatusOnline : ''}`}
                      >
                        ● {t(device.status)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className={styles.errorMsg}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btn}
              onClick={onClose}
              disabled={isPending}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isPending}
            >
              {isPending ? t('Creating…') : t('Create Group')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
