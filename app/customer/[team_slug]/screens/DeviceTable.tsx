'use client'

import React from 'react'
import { Device, Asset, Playlist } from './types'
import { DeviceTableRow } from './DeviceTableRow'
import styles from './screens.module.css'

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
  showSuccessPulse
}: DeviceTableProps) {
  return (
    <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
      <table className={styles.screensTable}>
        <thead className={styles.tableHeader}>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedDeviceIds.has(d.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)))
                  } else {
                    setSelectedDeviceIds(new Set())
                  }
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </th>
            <th>Screen Name</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Playing Now</th>
            <th>Actions</th>
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
              onGroupClick={handleGroupBadgeClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
