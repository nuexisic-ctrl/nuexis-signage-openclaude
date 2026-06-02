'use client'

import React, { useState, useEffect } from 'react'
import { Device } from './types'
import styles from './screens.module.css'

interface SelectedActionsProps {
  selectedDeviceIds: Set<string>
  setSelectedDeviceIds: (ids: Set<string>) => void
  setShowCreateGroupFromSelection: (show: boolean) => void
  setDeleteModalDevice: (device: Device | null) => void
  setAssignModalDevice: (device: Device | null) => void
}

export function SelectedActions({
  selectedDeviceIds,
  setSelectedDeviceIds,
  setShowCreateGroupFromSelection,
  setDeleteModalDevice,
  setAssignModalDevice,
}: SelectedActionsProps) {
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const handleOutsideClick = () => setShowDropdown(false)
    if (showDropdown) document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [showDropdown])

  if (selectedDeviceIds.size === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ 
        fontSize: '0.84rem', 
        fontFamily: 'var(--font-label)', 
        fontWeight: 800, 
        color: 'var(--primary)',
        marginRight: '4px'
      }}>
        {selectedDeviceIds.size} Selected
      </span>
      <button
        className={styles.filterBtn}
        onClick={() => setShowCreateGroupFromSelection(true)}
        style={{ 
          background: 'var(--primary-container)', 
          color: 'var(--primary)', 
          borderColor: 'transparent',
          fontWeight: 800
        }}
      >
        Create Group
      </button>
      <button
        className={styles.filterBtn}
        onClick={() => {
          const virtualDevice: Device = {
            id: Array.from(selectedDeviceIds).join(','),
            name: `${selectedDeviceIds.size} screens`,
            status: 'online',
            created_at: new Date().toISOString()
          }
          setDeleteModalDevice(virtualDevice)
        }}
        style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          color: '#ef4444', 
          borderColor: 'rgba(239, 68, 68, 0.2)',
          fontWeight: 800
        }}
      >
        Delete
      </button>
      
      {/* More Actions Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          className={styles.filterBtn}
          onClick={(e) => {
            e.stopPropagation()
            setShowDropdown(!showDropdown)
          }}
        >
          Actions
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '2px' }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {showDropdown && (
          <div style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-modal)',
            zIndex: 50,
            width: '160px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button
              style={{
                padding: '8px 12px',
                border: 'none',
                background: 'none',
                color: 'var(--on-surface)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.8125rem',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              onClick={() => {
                setShowDropdown(false)
                const virtualDevice: Device = {
                  id: Array.from(selectedDeviceIds).join(','),
                  name: `${selectedDeviceIds.size} Screens`,
                  status: 'online',
                  created_at: new Date().toISOString()
                }
                setAssignModalDevice(virtualDevice)
              }}
            >
              Assign Content
            </button>
            <button
              style={{
                padding: '8px 12px',
                border: 'none',
                background: 'none',
                color: 'var(--on-surface-muted)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.8125rem',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              onClick={() => {
                setShowDropdown(false)
                setSelectedDeviceIds(new Set())
              }}
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
