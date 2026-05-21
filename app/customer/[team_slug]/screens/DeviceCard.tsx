import React from 'react'
import styles from './DeviceCard.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'
import { DeviceIcon, StatusBadge, formatLastSeen, getContentLabel } from './DeviceIcon'

export interface DeviceCardProps {
  device: Device
  liveStatus: LiveStatus
  onEdit: () => void
  onDelete: () => void
  onRename: () => void
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  assets: Asset[]
  playlists: Playlist[]
}

export function DeviceCard({
  device,
  liveStatus,
  onEdit,
  onDelete,
  onRename,
  menuOpen,
  onToggleMenu,
  assets,
  playlists
}: DeviceCardProps) {
  const createdAt = new Date(device.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const lastSeen = formatLastSeen(device.last_seen_at, liveStatus === 'online')

  return (
    <div className={styles.deviceCard}>
      <div className={styles.deviceCardHeaderTop}>
        <div className={styles.deviceCardHeaderLeft}>
          <div className={styles.deviceCardIcon}>
            <DeviceIcon name={device.name || ''} orientation={device.orientation} />
          </div>
          <h3 className={styles.deviceName}>{device.name || 'Unnamed Screen'}</h3>
        </div>
        <div className={styles.statusAndMenu}>
          <StatusBadge status={liveStatus} />
          <div className={styles.moreMenuWrapper}>
            <button 
              className={`${styles.moreBtn} ${menuOpen ? styles.active : ''}`}
              onClick={onToggleMenu}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className={styles.moreDropdown}>
                <button className={styles.dropdownItem} onClick={onEdit}>
                  Edit Content
                </button>
                <button className={styles.dropdownItem} onClick={onRename}>
                  Rename
                </button>
                <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={onDelete}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.deviceMeta} onClick={onEdit} style={{ cursor: 'pointer' }}>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>ADDED</span>
          <span className={styles.deviceMetaValue}>{createdAt}</span>
        </div>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>CURRENT CONTENT</span>
          <span 
            className={styles.deviceMetaValue} 
            style={(!device.asset_id && !device.playlist_id) ? { fontStyle: 'italic', color: 'var(--on-surface-subtle)' } : {}}
          >
            {getContentLabel(device, assets, playlists)}
          </span>
        </div>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>LAST SEEN</span>
          <span className={styles.deviceMetaValue}>{lastSeen}</span>
        </div>
      </div>
    </div>
  )
}
