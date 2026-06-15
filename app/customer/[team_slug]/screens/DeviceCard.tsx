import React from 'react'
import styles from './DeviceCard.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'
import { DeviceIcon, StatusBadge, formatLastSeen, getContentLabel, resolveDeviceContent } from './DeviceIcon'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'

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
  groups?: any[]
  memberships?: any[]
  selected?: boolean
  onToggleSelect?: () => void
  onGroupClick?: (groupId: string) => void
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
  playlists,
  groups = [],
  memberships = [],
  selected = false,
  onToggleSelect,
  onGroupClick
}: DeviceCardProps) {
  const createdAt = new Date(device.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const lastSeen = formatLastSeen(device.last_seen_at, liveStatus === 'online')

  // Find member groups
  const deviceMemberships = memberships.filter(m => m.device_id === device.id)
  const deviceGroups = groups.filter(g => deviceMemberships.some(m => m.group_id === g.id))

  // Resolve content from group if device has no explicit content set
  const resolvedDevice = resolveDeviceContent(device, groups, memberships)
  const isInherited = !device.content_type && resolvedDevice.content_type
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('span[onClick]') ||
      target.closest('a') ||
      target.closest('[data-noclick]') ||
      target.closest(`.${styles.moreDropdown}`)
    ) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      return;
    }
    onEdit();
  };

  return (
    <div 
      className={`${styles.deviceCard} ${selected ? styles.deviceCardSelected : ''}`}
      onClick={handleCardClick}
    >
      <div className={styles.deviceCardHeaderTop}>
        <div className={styles.deviceCardHeaderLeft}>
          {onToggleSelect && (
            <div 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'rgba(7, 17, 31, 0.72)', 
                backdropFilter: 'blur(8px)',
                borderRadius: '4px',
                padding: '4px',
                marginRight: '10px',
                cursor: 'pointer',
                flexShrink: 0
              }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect()
              }}
            >
              <input 
                type="checkbox" 
                checked={selected} 
                onChange={(e) => {}} 
                style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, pointerEvents: 'none' }}
              />
            </div>
          )}
          <div className={styles.deviceCardIcon}>
            <DeviceIcon name={device.name || ''} orientation={device.orientation} app_version={device.app_version} os_version={device.os_version} />
          </div>
          <div>
            <h3 className={styles.deviceName}>
              <FilenameTruncator filename={device.name || 'Unnamed Screen'} />
            </h3>
            {deviceGroups.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                {deviceGroups.map(g => (
                  <span 
                    key={g.id} 
                    style={{ 
                      backgroundColor: g.color || '#3b82f6', 
                      color: '#fff', 
                      fontSize: '0.65rem', 
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
            )}
          </div>
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
      <div className={styles.deviceMeta}>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>ADDED</span>
          <span className={styles.deviceMetaValue}>{createdAt}</span>
        </div>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>CURRENT CONTENT</span>
          <span 
            className={styles.deviceMetaValue} 
            style={(!resolvedDevice.asset_id && !resolvedDevice.playlist_id) ? { fontStyle: 'italic', color: 'var(--on-surface-subtle)' } : {}}
          >
            <FilenameTruncator filename={getContentLabel(resolvedDevice, assets, playlists)} /> {isInherited && (
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.85, fontWeight: 500, fontStyle: 'italic', marginLeft: '4px' }}>
                (Group)
              </span>
            )}
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
