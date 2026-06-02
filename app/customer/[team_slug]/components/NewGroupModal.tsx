'use client'

import React, { useState, useRef, useTransition } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import { createGroup, updateGroupMembers } from '../groups/actions'
import styles from './NewGroupModal.module.css'
import { Device } from '../screens/types'

interface NewGroupModalProps {
  isOpen: boolean
  onClose: () => void
  teamSlug: string
  devices?: Device[]
  initialSelectedDeviceIds?: string[]
  onSuccess: (groupId: string) => void
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
]

export default function NewGroupModal({
  isOpen,
  onClose,
  teamSlug,
  devices = [],
  initialSelectedDeviceIds = [],
  onSuccess,
}: NewGroupModalProps) {
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(PRESET_COLORS[0])
  const [isCustomColorSelected, setIsCustomColorSelected] = useState(false)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(initialSelectedDeviceIds)
  const [screenSearch, setScreenSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const customColorInputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
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
            setErrorMsg(syncRes.error || 'Group created, but failed to assign selected screens.')
            return
          }
        }
        setGroupName('')
        setGroupColor(PRESET_COLORS[0])
        setIsCustomColorSelected(false)
        setSelectedDeviceIds([])
        onSuccess(result.groupId)
      } else {
        setErrorMsg(result.error || 'Failed to create group.')
      }
    })
  }

  const filteredDevices = devices.filter(d => 
    (d.name || '').toLowerCase().includes(screenSearch.toLowerCase())
  )

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New Screen Group</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Group Name (Optional)</label>
            <input
              type="text"
              maxLength={60}
              className={styles.input}
              placeholder="E.g., Airport Terminal, Retail Front"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Group Color Tag</label>
            <div className={styles.colorPickerGrid}>
              {PRESET_COLORS.map((c) => {
                const isSelected = groupColor === c && !isCustomColorSelected
                return (
                  <div
                    key={c}
                    className={`${styles.colorOption} ${
                      isSelected ? styles.colorOptionSelected : ''
                    }`}
                    style={{
                      backgroundColor: c,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onClick={() => {
                      setGroupColor(c)
                      setIsCustomColorSelected(false)
                    }}
                  >
                    {isSelected && <Check size={14} style={{ color: '#fff' }} />}
                  </div>
                )
              })}

              {/* Custom Color Selector Trigger */}
              <div style={{ position: 'relative', width: '32px', height: '32px' }}>
                <div
                  onClick={() => customColorInputRef.current?.click()}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    background: isCustomColorSelected
                      ? groupColor
                      : 'linear-gradient(45deg, red, orange, yellow, green, blue, purple)',
                    borderColor: isCustomColorSelected ? 'var(--on-surface)' : 'transparent',
                    boxShadow: isCustomColorSelected
                      ? '0 0 0 2px var(--surface-lowest) inset'
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.1s ease',
                  }}
                  title="Custom Color"
                >
                  {!isCustomColorSelected && (
                    <span style={{ fontSize: '8px', color: '#fff', fontWeight: 'bold' }}>Custom</span>
                  )}
                  {isCustomColorSelected && (
                    <Check
                      size={14}
                      style={{ color: '#fff', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))' }}
                    />
                  )}
                </div>
                <input
                  ref={customColorInputRef}
                  type="color"
                  value={isCustomColorSelected ? groupColor : '#3b82f6'}
                  onChange={(e) => {
                    setGroupColor(e.target.value)
                    setIsCustomColorSelected(true)
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Screen selection checklist */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Select Screens</label>
            <input 
              type="text" 
              className={styles.input} 
              style={{ minHeight: '38px', marginBottom: '6px' }}
              placeholder="Search screens..." 
              value={screenSearch} 
              onChange={(e) => setScreenSearch(e.target.value)} 
            />
            {devices.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-subtle)', fontStyle: 'italic', margin: '4px 0' }}>
                No screens available to assign.
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
                        ● {device.status}
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
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isPending}
            >
              {isPending ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
