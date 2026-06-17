'use client'

import React from 'react'
import { FolderPlus, Trash2 } from 'lucide-react'
import { Device } from './types'
import styles from './screens.module.css'
import { useTranslation } from '@/lib/i18n'

interface SelectedActionsProps {
  selectedDeviceIds: Set<string>
  setSelectedDeviceIds: (ids: Set<string>) => void
  setShowCreateGroupFromSelection: (show: boolean) => void
  setDeleteModalDevice: (device: Device | null) => void
}

export function SelectedActions({
  selectedDeviceIds,
  setSelectedDeviceIds,
  setShowCreateGroupFromSelection,
  setDeleteModalDevice,
}: SelectedActionsProps) {
  const { t } = useTranslation()

  if (selectedDeviceIds.size === 0) return null

  return (
    <div className={styles.selectedActionsContainer}>
      <div className={styles.selectedCountBadge} title={t('{count} screens selected', { count: selectedDeviceIds.size })}>
        <span className={styles.selectedCountNumber}>{selectedDeviceIds.size}</span>
        <span className={styles.selectedCountText}>{t('Selected')}</span>
      </div>
      
      <button
        className={styles.bulkActionIconBtn}
        onClick={() => setShowCreateGroupFromSelection(true)}
        title={t('Create Group from Selection')}
      >
        <FolderPlus size={16} className={styles.bulkActionBtnIcon} />
      </button>
      
      <button
        className={`${styles.bulkActionIconBtn} ${styles.bulkActionIconBtnDanger}`}
        onClick={() => {
          const virtualDevice: Device = {
            id: Array.from(selectedDeviceIds).join(','),
            name: t('{count} screens', { count: selectedDeviceIds.size }),
            status: 'online',
            created_at: new Date().toISOString()
          }
          setDeleteModalDevice(virtualDevice)
        }}
        title={t('Delete Selected Screens')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

