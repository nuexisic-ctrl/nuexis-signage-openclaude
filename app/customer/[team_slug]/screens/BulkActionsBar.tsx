'use client'

import React from 'react'
import { Device } from './types'
import { addDevicesToGroup, removeDevicesFromGroup } from '../groups/actions'
import styles from './screens.module.css'

interface BulkActionsBarProps {
  selectedDeviceIds: Set<string>
  setSelectedDeviceIds: (ids: Set<string>) => void
  groups: any[]
  teamSlug: string
  isPending: boolean
  startTransition: (cb: () => void) => void
  setAssignModalDevice: (device: Device | null) => void
  router: any
}

export function BulkActionsBar({
  selectedDeviceIds,
  setSelectedDeviceIds,
  groups,
  teamSlug,
  isPending,
  startTransition,
  setAssignModalDevice,
  router
}: BulkActionsBarProps) {
  if (selectedDeviceIds.size === 0) return null

  return (
    <div className={styles.bulkBar}>
      <span className={styles.bulkText}>{selectedDeviceIds.size} screens selected</span>
      <div className={styles.bulkActions}>
        {groups.length > 0 && (
          <select
            className={styles.bulkSelectDropdown}
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value
              if (!val) return
              const ids = Array.from(selectedDeviceIds)
              startTransition(async () => {
                if (val.startsWith('add:')) {
                  const gId = val.substring(4)
                  await addDevicesToGroup(teamSlug, gId, ids)
                } else if (val.startsWith('remove:')) {
                  const gId = val.substring(7)
                  await removeDevicesFromGroup(teamSlug, gId, ids)
                }
                setSelectedDeviceIds(new Set())
                router.refresh()
              })
              e.target.value = ""
            }}
            disabled={isPending}
          >
            <option value="" disabled>Group Operations...</option>
            <optgroup label="Add To Group">
              {groups.map(g => (
                <option key={`add:${g.id}`} value={`add:${g.id}`}>＋ {g.name}</option>
              ))}
            </optgroup>
            <optgroup label="Remove From Group">
              {groups.map(g => (
                <option key={`rem:${g.id}`} value={`remove:${g.id}`}>－ {g.name}</option>
              ))}
            </optgroup>
          </select>
        )}
        <button 
          className={styles.bulkBtn}
          onClick={() => {
            const virtualDevice: Device = {
              id: Array.from(selectedDeviceIds).join(','),
              name: `${selectedDeviceIds.size} Screens`,
              status: 'online',
              created_at: new Date().toISOString()
            }
            setAssignModalDevice(virtualDevice)
          }}
          disabled={isPending}
        >
          Assign Content
        </button>
        <button 
          className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
          onClick={() => setSelectedDeviceIds(new Set())}
          disabled={isPending}
        >
          Clear Selection
        </button>
      </div>
    </div>
  )
}
