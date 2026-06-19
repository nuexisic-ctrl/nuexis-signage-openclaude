'use client'

import React from 'react'
import { Device, Asset, Playlist } from './types'
import { DeviceTableRow } from './DeviceTableRow'
import styles from './screens.module.css'
import { useTranslation } from '@/lib/i18n'

interface DeviceTableProps {
  filteredDevices: Device[]
  selectedDeviceIds: Set<string>
  setSelectedDeviceIds: (ids: Set<string>) => void
  assets: Asset[]
  playlists: Playlist[]
  openMenuId: string | null
  menuPosition: { top: number, right: number } | null
  setOpenMenuId: (id: string | null) => void
  setMenuPosition: (pos: { top: number, right: number } | null) => void
  setAssignModalDevice: (device: Device | null) => void
  setRenameModalDevice: (device: Device | null) => void
  setDeleteModalDevice: (device: Device | null) => void
  groups: any[]
  memberships: any[]
  handleToggleSelect: (id: string) => void
  handleGroupBadgeClick: (groupId: string) => void
  getLiveStatus: (device: Device) => any
  showSuccessPulse: boolean
  now: number
  onItemClick?: (e: React.MouseEvent, id: string) => void
  onItemDoubleClick?: (device: Device) => void
}

export function DeviceTable({
  filteredDevices,
  selectedDeviceIds,
  setSelectedDeviceIds,
  assets,
  playlists,
  openMenuId,
  menuPosition,
  setOpenMenuId,
  setMenuPosition,
  setAssignModalDevice,
  setRenameModalDevice,
  setDeleteModalDevice,
  groups,
  memberships,
  handleToggleSelect,
  handleGroupBadgeClick,
  getLiveStatus,
  showSuccessPulse,
  now,
  onItemClick,
  onItemDoubleClick,
}: DeviceTableProps) {
  const { t } = useTranslation()
  return (
    <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
      <table className={styles.screensTable}>
        <thead className={styles.tableHeader}>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }} />
            <th style={{ width: '25%' }}>{t('Screen Name')}</th>
            <th style={{ width: '15%' }}>{t('Status')}</th>
            <th style={{ width: '20%' }}>{t('Last Seen')}</th>
            <th style={{ width: '30%' }}>{t('Playing Now')}</th>
            <th style={{ width: '10%', textAlign: 'right' }}>{t('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredDevices.map(device => (
            <DeviceTableRow
              key={device.id}
              device={device}
              liveStatus={getLiveStatus(device)}
              assets={assets}
              playlists={playlists}
              openMenuId={openMenuId}
              menuPosition={menuPosition}
              setOpenMenuId={setOpenMenuId}
              setMenuPosition={setMenuPosition}
              onEdit={() => setAssignModalDevice(device)}
              onRename={() => {
                setOpenMenuId(null);
                setRenameModalDevice(device);
              }}
              onDelete={() => {
                setOpenMenuId(null);
                setDeleteModalDevice(device);
              }}
              groups={groups}
              memberships={memberships}
              selected={selectedDeviceIds.has(device.id)}
              onToggleSelect={() => handleToggleSelect(device.id)}
              onItemClick={onItemClick}
              onItemDoubleClick={onItemDoubleClick}
              onGroupClick={handleGroupBadgeClick}
              now={now}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
