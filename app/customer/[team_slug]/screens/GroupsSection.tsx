'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, Image as ImageIcon, ListVideo, Monitor, Edit3, Trash2, FolderTree
} from 'lucide-react'
import styles from './GroupsSection.module.css'
import { Device } from './types'

interface Group {
  id: string
  name: string
  color: string
  content_type: 'Asset' | 'Playlist' | 'Schedule' | null
  asset_id: string | null
  playlist_id: string | null
  orientation: number | null
}

interface Membership {
  group_id: string
  device_id: string
}

interface GroupsSectionProps {
  groups: Group[]
  devices: Device[]
  memberships: Membership[]
  assets: any[]
  playlists: any[]
  teamSlug: string
  onSelectGroup: (group: Group) => void
  onDeleteGroup: (group: Group) => void
}

export function GroupsSection({
  groups,
  devices,
  memberships,
  assets,
  playlists,
  teamSlug,
  onSelectGroup,
  onDeleteGroup
}: GroupsSectionProps) {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('groupsViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

  const handleSetViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode)
    localStorage.setItem('groupsViewMode', mode)
  }

  return (
    <div className={styles.sectionContainer}>
      <div className={styles.mainBlockContainer}>
        <div className={styles.controlsBar}>
          <div className={styles.headerTitleArea}>
            <FolderTree size={18} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Groups</h2>
            <span className={styles.groupCountBadge}>{groups.length}</span>
          </div>
          {isMounted && groups.length > 0 && (
            <div className={styles.viewToggleGroup}>
              <button 
                className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                onClick={() => handleSetViewMode('table')}
                title="Table View"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </button>
              <button 
                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => handleSetViewMode('grid')}
                title="Grid View"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" ry="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1" ry="1"></rect>
                  <rect x="14" y="14" width="7" height="7" rx="1" ry="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1" ry="1"></rect>
                </svg>
              </button>
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FolderTree size={20} />
            </div>
            <h3 className={styles.emptyTitle}>No groups created yet</h3>
            <p className={styles.emptyText}>
              Use the "+ New Group" button to organize your screens.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Screens</th>
                <th>Live Status</th>
                <th>Content Assigned</th>
                <th>Orientation</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupMemberships = memberships.filter(m => m.group_id === group.id)
                const memberIds = groupMemberships.map(m => m.device_id)
                const memberDevices = devices.filter(d => memberIds.includes(d.id))
                const onlineCount = memberDevices.filter(d => d.status === 'online').length
                const offlineCount = memberDevices.length - onlineCount

                let contentName = 'Unassigned'
                if (group.content_type === 'Asset') {
                  const ast = assets.find(a => a.id === group.asset_id)
                  contentName = ast ? ast.file_name : 'Deleted Asset'
                } else if (group.content_type === 'Playlist') {
                  const pl = playlists.find(p => p.id === group.playlist_id)
                  contentName = pl ? pl.name : 'Deleted Playlist'
                }

                let orientationText = 'Landscape (0°)'
                if (group.orientation === 90) orientationText = 'Rotate 90°'
                else if (group.orientation === 180) orientationText = 'Rotate 180°'
                else if (group.orientation === 270) orientationText = 'Rotate 270°'

                return (
                  <tr key={group.id} className={styles.tableRow} onClick={() => onSelectGroup(group)}>
                    <td>
                      <div className={styles.groupNameCell}>
                        <span 
                          className={styles.colorIndicator} 
                          style={{ backgroundColor: group.color || '#3b82f6' }}
                        />
                        <span className={styles.groupNameText}>{group.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.memberCount}>
                        <Monitor size={14} className={styles.subIcon} />
                        {memberDevices.length} {memberDevices.length === 1 ? 'screen' : 'screens'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        {memberDevices.length > 0 ? (
                          <>
                            {onlineCount > 0 && (
                              <span className={styles.onlineBadge}>
                                <span className={styles.statusDotOnline} /> {onlineCount} online
                              </span>
                            )}
                            {offlineCount > 0 && (
                              <span className={styles.offlineBadge}>
                                <span className={styles.statusDotOffline} /> {offlineCount} offline
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={styles.noScreensText}>No screens</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.contentCell}>
                        {group.content_type ? (
                          <>
                            {group.content_type === 'Playlist' ? (
                              <ListVideo size={14} className={styles.contentIcon} />
                            ) : (
                              <ImageIcon size={14} className={styles.contentIcon} />
                            )}
                            <span className={styles.contentLabelText} title={contentName}>{contentName}</span>
                          </>
                        ) : (
                          <span className={styles.unassignedText}>Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.orientationText}>{orientationText}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actionsCell}>
                        <button 
                          className={styles.actionBtn} 
                          onClick={() => onSelectGroup(group)}
                          title="Edit Group"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                          onClick={() => onDeleteGroup(group)}
                          title="Delete Group"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.grid}>
          {groups.map((group) => {
            const groupMemberships = memberships.filter(m => m.group_id === group.id)
            const memberIds = groupMemberships.map(m => m.device_id)
            const memberDevices = devices.filter(d => memberIds.includes(d.id))
            const onlineCount = memberDevices.filter(d => d.status === 'online').length
            const offlineCount = memberDevices.length - onlineCount

            let contentName = 'Unassigned'
            if (group.content_type === 'Asset') {
              const ast = assets.find(a => a.id === group.asset_id)
              contentName = ast ? ast.file_name : 'Deleted Asset'
            } else if (group.content_type === 'Playlist') {
              const pl = playlists.find(p => p.id === group.playlist_id)
              contentName = pl ? pl.name : 'Deleted Playlist'
            }

            return (
              <div 
                key={group.id} 
                className={styles.card} 
                style={{ '--group-border-color': group.color || '#3b82f6' } as React.CSSProperties}
                onClick={() => onSelectGroup(group)}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{group.name}</h3>
                  <div className={styles.cardBadge}>
                    <Users size={12} />
                    {memberDevices.length}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardContentPreview}>
                    <div className={styles.cardContentThumb}>
                      {group.content_type === 'Playlist' ? <ListVideo size={16} /> : <ImageIcon size={16} />}
                    </div>
                    <div className={styles.cardContentMeta}>
                      <div className={styles.cardContentLabel}>{group.content_type || 'Unassigned'}</div>
                      <div className={styles.cardContentName} title={contentName}>{contentName}</div>
                    </div>
                  </div>

                  <div className={styles.cardStatusRow}>
                    <span className={styles.cardStatus}>
                      <span className={styles.statusDotOnline} /> {onlineCount} online
                    </span>
                    <span className={styles.cardStatus}>
                      <span className={styles.statusDotOffline} /> {offlineCount} offline
                    </span>
                  </div>
                </div>

                <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                  <button 
                    className={styles.cardBtn} 
                    onClick={() => onSelectGroup(group)}
                  >
                    Edit Group
                  </button>
                  <button 
                    className={`${styles.cardBtn} ${styles.cardBtnDanger}`} 
                    onClick={() => onDeleteGroup(group)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
