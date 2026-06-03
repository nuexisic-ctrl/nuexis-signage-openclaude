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
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(PRESET_COLORS[0])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(initialSelectedDeviceIds)
  const [screenSearch, setScreenSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)
  const startedOnOverlayRef = useRef(false)

  if (!isOpen) return null

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    startedOnOverlayRef.current = e.target === overlayRef.current
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && startedOnOverlayRef.current) onClose()
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
    <div 
      className={styles.overlay} 
      ref={overlayRef} 
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
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
                const isSelected = groupColor === c
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
                    onClick={() => setGroupColor(c)}
                  >
                    {isSelected && <Check size={14} style={{ color: '#fff' }} />}
                  </div>
                )
              })}
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
