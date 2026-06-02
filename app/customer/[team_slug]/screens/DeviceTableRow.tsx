import React from 'react'
import { createPortal } from 'react-dom'
import styles from './DeviceTableRow.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'
import {
  DeviceIcon, StatusBadge, formatLastSeen,
  getContentLabel, getContentKind, ContentIcon,
  resolveDeviceContent
} from './DeviceIcon'

export interface DeviceTableRowProps {
  device: Device
  liveStatus: LiveStatus
  assets: Asset[]
  playlists: Playlist[]
  openMenuId: string | null
  menuPosition: { top: number, right: number } | null
  setOpenMenuId: (id: string | null) => void
  setMenuPosition: (pos: { top: number, right: number } | null) => void
  onEdit: () => void
  onRename: () => void
  onDelete: () => void
  groups?: any[]
  memberships?: any[]
  selected?: boolean
  onToggleSelect?: () => void
  onGroupClick?: (groupId: string) => void
}

export function DeviceTableRow({
  device,
  liveStatus,
  assets,
  playlists,
  openMenuId,
  menuPosition,
  setOpenMenuId,
  setMenuPosition,
  onEdit,
  onRename,
  onDelete,
  groups = [],
  memberships = [],
  selected = false,
  onToggleSelect,
  onGroupClick
}: DeviceTableRowProps) {
  const lastSeen = formatLastSeen(device.last_seen_at, liveStatus === 'online')
  const isMenuOpen = openMenuId === device.id
  const isOnline = liveStatus === 'online'

  // Find member groups
  const deviceMemberships = memberships.filter(m => m.device_id === device.id)
  const deviceGroups = groups.filter(g => deviceMemberships.some(m => m.group_id === g.id))

  // Resolve content from group if device has no explicit content set
  const resolvedDevice = resolveDeviceContent(device, groups, memberships)
  const kind = getContentKind(resolvedDevice, assets, playlists)
  const label = getContentLabel(resolvedDevice, assets, playlists)
  const isEmpty = kind === 'empty'
  const isInherited = !device.content_type && resolvedDevice.content_type

  const kindClassMap: Record<string, string> = {
    clock:        styles.contentIcon_clock,
    image:        styles.contentIcon_image,
    video:        styles.contentIcon_video,
    youtube:      styles.contentIcon_youtube,
    'remote-url': styles['contentIcon_remote-url'],
    'html-widget': styles['contentIcon_html-widget'],
    playlist:     styles.contentIcon_playlist,
  }

  return (
    <tr className={`${styles.tableRow} ${selected ? styles.rowSelected : ''}`}>
      {onToggleSelect && (
        <td className={styles.tableCell} style={{ width: '40px', textAlign: 'center' }}>
          <input 
            type="checkbox" 
            checked={selected} 
            onChange={onToggleSelect} 
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
        </td>
      )}
      <td className={styles.tableCell}>
        <div className={styles.nameCellContent}>
          <div className={styles.deviceIconWrapper}>
            <DeviceIcon name={device.name || ''} orientation={device.orientation} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.cellName}>{device.name || 'Unnamed Screen'}</div>
              {deviceGroups.map(g => (
                <span 
                  key={g.id} 
                  style={{ 
                    backgroundColor: g.color || '#3b82f6', 
                    color: '#fff', 
                    fontSize: '0.625rem', 
                    padding: '1px 5px', 
                    borderRadius: '3px', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--font-label)',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onGroupClick?.(g.id)
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>
            <div className={styles.cellId}>
              ID: NX-{device.id.slice(0, 4).toUpperCase()}-{device.id.slice(4, 5).toUpperCase()}
            </div>
          </div>
        </div>
      </td>

      <td className={styles.tableCell}>
        <StatusBadge status={liveStatus} />
      </td>

      <td className={styles.tableCell}>
        <div className={styles.cellLastSeen}>
          <span
            className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : styles.statusDotOffline}`}
            style={{ marginRight: '8px' }}
          />
          {lastSeen}
        </div>
      </td>

      {/* ── Playing Now cell ── */}
      <td className={styles.tableCell}>
        <div 
          className={`${styles.playlistCell} ${isEmpty ? styles.playlistCellEmpty : ''}`}
          onClick={onEdit}
          style={{ cursor: 'pointer' }}
        >
          <span className={`${styles.contentIconWrap} ${kindClassMap[kind] ?? ''}`}>
            <ContentIcon kind={kind} size={16} />
          </span>
          <span className={isEmpty ? styles.playlistCellEmptyText : styles.playlistCellText}>
            {label} {isInherited && (
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.85, fontWeight: 500, fontStyle: 'italic', marginLeft: '4px' }}>
                (Group)
              </span>
            )}
          </span>
        </div>
      </td>

      <td className={styles.tableCell}>
        <div className={styles.actionsGroup}>
          <button className={styles.actionBtnBox} onClick={onEdit} aria-label="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <div className={styles.moreMenuWrapper}>
            <button
              className={`${styles.actionBtnBox} ${isMenuOpen ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isMenuOpen) {
                  setOpenMenuId(null)
                  setMenuPosition(null)
                } else {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setMenuPosition({
                    top: rect.bottom + window.scrollY + 6,
                    right: window.innerWidth - rect.right,
                  })
                  setOpenMenuId(device.id)
                }
              }}
              aria-label="More Actions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {isMenuOpen && menuPosition && typeof window !== 'undefined' && createPortal(
              <div
                className={styles.moreDropdown}
                style={{ position: 'absolute', top: menuPosition.top, right: menuPosition.right, zIndex: 1000 }}
                onClick={e => e.stopPropagation()}
              >
                <button className={styles.dropdownItem} onClick={() => {
                  setOpenMenuId(null)
                  setMenuPosition(null)
                  onEdit()
                }}>
                  Edit Content
                </button>
                <button className={styles.dropdownItem} onClick={() => {
                  setOpenMenuId(null)
                  setMenuPosition(null)
                  onRename()
                }}>
                  Rename
                </button>
                <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={() => {
                  setOpenMenuId(null)
                  setMenuPosition(null)
                  onDelete()
                }}>
                  Delete
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
