import React from 'react'
import { createPortal } from 'react-dom'
import styles from './DeviceTableRow.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'
import { DeviceIcon, StatusBadge, formatLastSeen, getContentLabel } from './DeviceIcon'

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
  onDelete
}: DeviceTableRowProps) {
  const lastSeen = formatLastSeen(device.last_seen_at, liveStatus === 'online')
  const isMenuOpen = openMenuId === device.id
  const isOnline = liveStatus === 'online'

  return (
    <tr className={styles.tableRow}>
      <td className={styles.tableCell}>
        <div className={styles.nameCellContent}>
          <div className={styles.deviceIconWrapper}>
            <DeviceIcon name={device.name || ''} orientation={device.orientation} />
          </div>
          <div>
            <div className={styles.cellName}>{device.name || 'Unnamed Screen'}</div>
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
      <td className={styles.tableCell}>
        <div className={styles.playlistCell}>
          <svg className={styles.playlistIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {device.asset_id || device.playlist_id ? (
              <>
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </>
            ) : (
              <>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.36-1.36"></path>
              </>
            )}
          </svg>
          <span style={(!device.asset_id && !device.playlist_id) ? { fontStyle: 'italic', color: 'var(--on-surface-subtle)' } : {}}>
            {getContentLabel(device, assets, playlists)}
          </span>
        </div>
      </td>
      <td className={styles.tableCell}>
        <div className={styles.actionsGroup}>
          <button className={styles.actionBtnBox} onClick={onEdit} aria-label="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
          <div className={styles.moreMenuWrapper}>
            <button 
              className={`${styles.actionBtnBox} ${isMenuOpen ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) {
                  setOpenMenuId(null);
                  setMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition({ 
                    top: rect.bottom + window.scrollY + 6, 
                    right: window.innerWidth - rect.right 
                  });
                  setOpenMenuId(device.id);
                }
              }}
              aria-label="More Actions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>
            {isMenuOpen && menuPosition && typeof window !== 'undefined' && createPortal(
              <div 
                className={styles.moreDropdown}
                style={{ position: 'absolute', top: menuPosition.top, right: menuPosition.right, zIndex: 1000 }}
                onClick={e => e.stopPropagation()}
              >
                <button className={styles.dropdownItem} onClick={() => {
                  setOpenMenuId(null);
                  setMenuPosition(null);
                  onEdit();
                }}>
                  Edit Content
                </button>
                <button className={styles.dropdownItem} onClick={() => {
                  setOpenMenuId(null);
                  setMenuPosition(null);
                  onRename();
                }}>
                  Rename
                </button>
                <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={() => {
                  setOpenMenuId(null);
                  setMenuPosition(null);
                  onDelete();
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
