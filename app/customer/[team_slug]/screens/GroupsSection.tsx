'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, Monitor, Edit3, Trash2, FolderTree, ChevronLeft, ChevronRight
} from 'lucide-react'
import { ContentIcon, ContentKind } from './DeviceIcon'
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
  onlineDeviceIds?: Set<string>
  onSelectGroup: (group: Group) => void
  onDeleteGroup: (group: Group) => void
  isRefreshing?: boolean
  showSuccessPulse?: boolean
}

function getGroupContentKind(group: Group, assets: any[]): ContentKind {
  if (group.content_type === 'Playlist') return 'playlist'
  if (group.content_type === 'Asset' && group.asset_id) {
    const asset = assets.find(a => a.id === group.asset_id)
    if (asset?.mime_type) {
      if (asset.mime_type === 'application/x-widget-youtube') return 'youtube'
      if (asset.mime_type === 'application/x-widget-remote-url') return 'remote-url'
      if (asset.mime_type === 'application/x-widget-html') return 'html-widget'
      if (asset.mime_type === 'application/x-widget-flow') return 'clock'
      if (asset.mime_type === 'application/x-widget-countdown') return 'countdown'
      if (asset.mime_type.startsWith('video/')) return 'video'
      if (asset.mime_type.startsWith('image/')) return 'image'
    }
    return 'image'
  }
  return 'empty'
}

export function GroupsSection({
  groups,
  devices,
  memberships,
  assets,
  playlists,
  teamSlug,
  onlineDeviceIds,
  onSelectGroup,
  onDeleteGroup,
  isRefreshing = false,
  showSuccessPulse = false
}: GroupsSectionProps) {
  const kindClassMap: Record<string, string> = {
    clock:        styles.contentIcon_clock,
    countdown:    styles.contentIcon_countdown,
    image:        styles.contentIcon_image,
    video:        styles.contentIcon_video,
    youtube:      styles.contentIcon_youtube,
    'remote-url': styles['contentIcon_remote-url'],
    'html-widget': styles['contentIcon_html-widget'],
    playlist:     styles.contentIcon_playlist,
  }

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [isMounted, setIsMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(5)

  useEffect(() => {
    const savedLimit = localStorage.getItem('nuexis_groups_per_page')
    if (savedLimit) {
      setPageSize(Number(savedLimit) || 5)
    }
  }, [])

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

  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return groups
    return groups.filter(g => (g.name || '').toLowerCase().includes(q))
  }, [groups, searchQuery])

  const totalPages = Math.ceil(filteredGroups.length / pageSize) || 1

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [filteredGroups, currentPage, totalPages])

  const paginatedGroups = React.useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return filteredGroups.slice(from, from + pageSize)
  }, [filteredGroups, currentPage, pageSize])

  const startItem = filteredGroups.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredGroups.length)

  return (
    <div className={styles.sectionContainer}>
      <div className={styles.mainBlockContainer}>
        <div className={styles.controlsBar}>
          {isMounted && groups.length > 0 && (
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input 
                type="text" 
                className={styles.searchInput}
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}
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

        <div className={`${styles.progressBarWrapper} ${isRefreshing ? styles.active : ''}`}>
          <div className={styles.progressBarLine} />
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
        ) : filteredGroups.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FolderTree size={20} />
            </div>
            <h3 className={styles.emptyTitle}>No groups found</h3>
            <p className={styles.emptyText}>
              No groups matched your search criteria.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Group Name</th>
                <th style={{ width: '15%' }}>Screens</th>
                <th style={{ width: '20%' }}>Live Status</th>
                <th style={{ width: '30%' }}>Content Assigned</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.map((group) => {
                const groupMemberships = memberships.filter(m => m.group_id === group.id)
                const memberIds = groupMemberships.map(m => m.device_id)
                const memberDevices = devices.filter(d => memberIds.includes(d.id))
                const onlineCount = memberDevices.filter(d => onlineDeviceIds ? onlineDeviceIds.has(d.id) : d.status === 'online').length
                const offlineCount = memberDevices.length - onlineCount

                let contentName = 'no content'
                if (group.content_type === 'Asset') {
                  const ast = assets.find(a => a.id === group.asset_id)
                  contentName = ast ? ast.file_name : 'Deleted Asset'
                } else if (group.content_type === 'Playlist') {
                  const pl = playlists.find(p => p.id === group.playlist_id)
                  contentName = pl ? pl.name : 'Deleted Playlist'
                }



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
                            <span className={`${styles.contentIconWrap} ${kindClassMap[getGroupContentKind(group, assets)] ?? ''}`}>
                              <ContentIcon kind={getGroupContentKind(group, assets)} size={15} />
                            </span>
                            <span className={styles.contentLabelText} title={contentName}>{contentName}</span>
                          </>
                        ) : (
                          <span className={styles.unassignedText}>no content</span>
                        )}
                      </div>
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
                        <button
                          className={styles.actionBtn}
                          onClick={(e) => e.stopPropagation()}
                          title="More options"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                            <circle cx="5" cy="12" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="19" cy="12" r="1.5" />
                          </svg>
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
        <div className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
          {paginatedGroups.map((group) => {
            const groupMemberships = memberships.filter(m => m.group_id === group.id)
            const memberIds = groupMemberships.map(m => m.device_id)
            const memberDevices = devices.filter(d => memberIds.includes(d.id))
            const onlineCount = memberDevices.filter(d => onlineDeviceIds ? onlineDeviceIds.has(d.id) : d.status === 'online').length
            const offlineCount = memberDevices.length - onlineCount

            let contentName = 'no content'
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
                      <ContentIcon
                        kind={group.content_type === 'Playlist' ? 'playlist' : getGroupContentKind(group, assets)}
                        size={15}
                      />
                    </div>
                    <div className={styles.cardContentMeta}>
                      <div className={styles.cardContentLabel}>{group.content_type || 'no content'}</div>
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
      
      {groups.length > 0 && filteredGroups.length > 0 && (
        <div className={styles.tableFooter}>
          <div className={styles.paginationInfo}>
            Showing {startItem} to {endItem} of {filteredGroups.length} groups
          </div>
          <div className={styles.footerControls}>
            <div className={styles.perPageSelector}>
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value
                  const newLimit = parseInt(val, 10)
                  setPageSize(newLimit)
                  setCurrentPage(1)
                  localStorage.setItem('nuexis_groups_per_page', String(newLimit))
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className={styles.pagination}>
              <span className={styles.pageIndicator}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{ cursor: currentPage > 1 ? 'pointer' : 'not-allowed' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                className={styles.pageBtn} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{ cursor: currentPage < totalPages ? 'pointer' : 'not-allowed' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
