'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, Monitor, Edit3, Trash2, FolderTree, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react'
import { ContentIcon, ContentKind } from './DeviceIcon'
import styles from './GroupsSection.module.css'
import { Device } from './types'
import { deleteGroup } from '../groups/actions'
import { toast } from '@/app/components/Toast'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { useTranslation } from '@/lib/i18n'
import EmptyState from '../components/EmptyState'
import { createClient } from '@/lib/supabase/client'

interface Group {
  id: string
  name: string
  color: string
  content_type: 'Asset' | 'Playlist' | null
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
  onCreateGroup?: () => void
  isRefreshing?: boolean
  showSuccessPulse?: boolean
  highlightedGroupId?: string | null
}

function getGroupContentKind(group: Group, assets: any[]): ContentKind {
  if (group.content_type === 'Playlist') return 'playlist'
  if (group.content_type === 'Asset' && group.asset_id) {
    const asset = assets.find(a => a.id === group.asset_id)
    if (asset?.mime_type) {
      if (asset.mime_type === 'application/x-widget-youtube') return 'youtube'
      if (asset.mime_type === 'application/x-widget-remote-url' || asset.mime_type === 'application/x-widget-website') return 'remote-url'
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
  onCreateGroup,
  isRefreshing = false,
  showSuccessPulse = false,
  highlightedGroupId = null
}: GroupsSectionProps) {
  const { t } = useTranslation()
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

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [isMounted, setIsMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(5)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const selectDropdownRef = React.useRef<HTMLDivElement>(null)

  const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null)

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenuGroupId(null)
    }
    if (openMenuGroupId) {
      document.addEventListener('click', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [openMenuGroupId])


  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setIsSelectDropdownOpen(false)
      }
    }
    if (isSelectDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isSelectDropdownOpen])

  const handleDeleteSelectedGroups = () => {
    if (selectedGroupIds.size === 0) return
    setIsBulkDeleteOpen(true)
  }

  const handleConfirmDeleteSelectedGroups = () => {
    startTransition(async () => {
      let successCount = 0
      let lastError = ''
      const supabase = createClient()
      
      // Collect all member devices of deleted groups to notify them
      const affectedDeviceIds = new Set<string>()
      for (const groupId of selectedGroupIds) {
        memberships
          .filter(m => m.group_id === groupId)
          .forEach(m => affectedDeviceIds.add(m.device_id))
      }

      for (const groupId of selectedGroupIds) {
        const group = groups.find(g => g.id === groupId)
        const name = group ? group.name : 'Group'
        const res = await deleteGroup(teamSlug, groupId)
        if (res.success) {
          successCount++
        } else {
          lastError = res.error || t('Failed to delete group "{name}".', { name })
        }
      }
      if (successCount > 0) {
        // Broadcast content_update to all affected devices so they re-sync
        for (const devId of affectedDeviceIds) {
          const channel = supabase.channel(`device-pair-${devId}`)
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'content_update',
                payload: { timestamp: Date.now() }
              }).catch(console.error)
              setTimeout(() => supabase.removeChannel(channel), 1000)
            }
          })
        }

        toast.success(t('Deleted {count} group(s) successfully', { count: successCount }))
        setSelectedGroupIds(new Set())
        router.refresh()
      }
      if (lastError) {
        toast.error(lastError)
      }
      setIsBulkDeleteOpen(false)
    })
  }

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

  useEffect(() => {
    if (highlightedGroupId) {
      // Find page containing the group and switch to it if needed
      const groupIndex = filteredGroups.findIndex(g => g.id === highlightedGroupId)
      if (groupIndex !== -1) {
        const targetPage = Math.floor(groupIndex / pageSize) + 1
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage)
        }
      }
      
      // Delay slightly to allow rendering page switch before scrolling
      const timer = setTimeout(() => {
        const element = document.querySelector(`[data-group-row-id="${highlightedGroupId}"], [data-group-card-id="${highlightedGroupId}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [highlightedGroupId, filteredGroups, pageSize])

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
            <div className={styles.controlsLeft}>
              <div className={styles.globalSelectContainer} ref={selectDropdownRef}>
                <input 
                  type="checkbox" 
                  checked={filteredGroups.length > 0 && filteredGroups.every(g => selectedGroupIds.has(g.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)))
                    } else {
                      setSelectedGroupIds(new Set())
                    }
                  }}
                  aria-label={t('Select all groups')}
                  className={styles.globalSelectCheckbox}
                />
                <button
                  type="button"
                  onClick={() => setIsSelectDropdownOpen(!isSelectDropdownOpen)}
                  className={styles.globalSelectDropdownBtn}
                  aria-label={t('Open selection menu')}
                >
                  <ChevronDown size={14} />
                </button>

                {isSelectDropdownOpen && (
                  <div className={styles.globalSelectDropdownMenu}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)))
                        setIsSelectDropdownOpen(false)
                      }}
                      className={styles.globalSelectDropdownItem}
                    >
                      {t('Select All')} ({filteredGroups.length})
                    </button>
                    <div className={styles.globalSelectDropdownDivider} />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupIds(new Set())
                        setIsSelectDropdownOpen(false)
                      }}
                      className={`${styles.globalSelectDropdownItem} ${styles.globalSelectDropdownItemDanger}`}
                    >
                      {t('Deselect All')}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.searchBox}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  className={styles.searchInput}
                  placeholder={t('Search groups...')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>
          )}
          {isMounted && groups.length > 0 && (
            <div className={styles.controlsRight}>
              {selectedGroupIds.size > 0 && (
                <div className={styles.selectedActionsContainer}>
                  <div className={styles.selectedCountBadge} title={t('{count} groups selected', { count: selectedGroupIds.size })}>
                    <span className={styles.selectedCountNumber}>{selectedGroupIds.size}</span>
                    <span className={styles.selectedCountText}>{t('Selected')}</span>
                  </div>
                  <button
                    className={`${styles.bulkActionIconBtn} ${styles.bulkActionIconBtnDanger}`}
                    onClick={handleDeleteSelectedGroups}
                    title={t('Delete Selected Groups')}
                    type="button"
                    disabled={isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className={styles.bulkActionIconBtn}
                    onClick={() => setSelectedGroupIds(new Set())}
                    title={t('Clear selection')}
                    type="button"
                    disabled={isPending}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              )}
              <div className={styles.viewToggleGroup}>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('table')}
                  title={t('Table View')}
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
                  title={t('Grid View')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" ry="1"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1" ry="1"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1" ry="1"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1" ry="1"></rect>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`${styles.progressBarWrapper} ${(isRefreshing || isPending) ? styles.active : ''}`}>
          <div className={styles.progressBarLine} />
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title={t('No groups created yet')}
            description={t('Use the "+ New Group" button to organize your screens.')}
            icon={<FolderTree aria-hidden="true" size={20} />}
            action={onCreateGroup ? (
              <button
                type="button"
                onClick={onCreateGroup}
                style={{
                  padding: '10px 20px',
                  background: 'var(--primary)',
                  color: 'var(--on-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('Create Group')}
              </button>
            ) : undefined}
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            title={t('No groups found')}
            description={t('No groups matched your search criteria.')}
            icon={<FolderTree aria-hidden="true" size={20} />}
          />
        ) : viewMode === 'table' ? (
          <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }} />
                <th style={{ width: '25%' }}>{t('Group Name')}</th>
                <th style={{ width: '15%' }}>{t('Screens')}</th>
                <th style={{ width: '20%' }}>{t('Live Status')}</th>
                <th style={{ width: '30%' }}>{t('Content Assigned')}</th>
                <th style={{ width: '10%', textAlign: 'right' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.map((group) => {
                const groupMemberships = memberships.filter(m => m.group_id === group.id)
                const memberIds = groupMemberships.map(m => m.device_id)
                const memberDevices = devices.filter(d => memberIds.includes(d.id))
                const onlineCount = memberDevices.filter(d => {
                  if (onlineDeviceIds?.has(d.id)) return true
                  if (d.status === 'online' && d.last_seen_at) {
                    const lastSeenMs = new Date(d.last_seen_at).getTime()
                    return !isNaN(lastSeenMs) && (Date.now() - lastSeenMs) < 180000
                  }
                  return false
                }).length
                const offlineCount = memberDevices.length - onlineCount

                let contentName = t('no content')
                if (group.content_type === 'Asset') {
                  const ast = assets.find(a => a.id === group.asset_id)
                  contentName = ast ? ast.file_name : t('no content')
                } else if (group.content_type === 'Playlist') {
                  const pl = playlists.find(p => p.id === group.playlist_id)
                  contentName = pl ? pl.name : t('no content')
                }

                const isSelected = selectedGroupIds.has(group.id)

                return (
                  <tr 
                    key={group.id} 
                    data-group-row-id={group.id}
                    className={`${styles.tableRow} ${isSelected ? styles.rowSelected : ''} ${group.id === highlightedGroupId ? styles.highlightedGroup : ''}`} 
                    onClick={() => onSelectGroup(group)}
                  >
                    <td 
                      style={{ width: '40px', textAlign: 'center', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedGroupIds(prev => {
                          const next = new Set(prev)
                          if (next.has(group.id)) {
                            next.delete(group.id)
                          } else {
                            next.add(group.id)
                          }
                          return next
                        })
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', pointerEvents: 'none' }}
                      />
                    </td>
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
                        {memberDevices.length} {memberDevices.length === 1 ? t('screen') : t('screens')}
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        {memberDevices.length > 0 ? (
                          <>
                            {onlineCount > 0 && (
                              <span className={styles.onlineBadge}>
                                <span className={styles.statusDotOnline} /> {onlineCount} {t('online')}
                              </span>
                            )}
                            {offlineCount > 0 && (
                              <span className={styles.offlineBadge}>
                                <span className={styles.statusDotOffline} /> {offlineCount} {t('offline')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={styles.noScreensText}>{t('No screens')}</span>
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
                            <span className={styles.contentLabelText} title={contentName}>
                              <FilenameTruncator filename={contentName} />
                            </span>
                          </>
                        ) : (
                          <span className={styles.unassignedText}>{t('no content')}</span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actionsCell}>
                        <button 
                          className={styles.actionBtn} 
                          onClick={() => onSelectGroup(group)}
                          title={t('Edit Group')}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                          onClick={() => onDeleteGroup(group)}
                          title={t('Delete Group')}
                        >
                          <Trash2 size={15} />
                        </button>
                        <div className={styles.moreMenuWrapper}>
                          <button
                            className={`${styles.actionBtn} ${openMenuGroupId === group.id ? styles.active : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuGroupId(openMenuGroupId === group.id ? null : group.id);
                            }}
                            title={t('More options')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                              <circle cx="5" cy="12" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="19" cy="12" r="1.5" />
                            </svg>
                          </button>
                          {openMenuGroupId === group.id && (
                            <div className={styles.moreDropdown}>
                              <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                  setOpenMenuGroupId(null);
                                  onSelectGroup(group);
                                }}
                              >
                                {t('Edit Group')}
                              </button>
                              <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                  setOpenMenuGroupId(null);
                                  onSelectGroup(group);
                                }}
                              >
                                {t('Assign Playlist/Asset')}
                              </button>
                              <button
                                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                                onClick={() => {
                                  setOpenMenuGroupId(null);
                                  onDeleteGroup(group);
                                }}
                              >
                                {t('Delete Group')}
                              </button>
                            </div>
                          )}
                        </div>
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
            const onlineCount = memberDevices.filter(d => {
              if (onlineDeviceIds?.has(d.id)) return true
              if (d.status === 'online' && d.last_seen_at) {
                const lastSeenMs = new Date(d.last_seen_at).getTime()
                return !isNaN(lastSeenMs) && (Date.now() - lastSeenMs) < 180000
              }
              return false
            }).length
            const offlineCount = memberDevices.length - onlineCount

            let contentName = t('no content')
            if (group.content_type === 'Asset') {
              const ast = assets.find(a => a.id === group.asset_id)
              contentName = ast ? ast.file_name : t('no content')
            } else if (group.content_type === 'Playlist') {
              const pl = playlists.find(p => p.id === group.playlist_id)
              contentName = pl ? pl.name : t('no content')
            }

            const isSelected = selectedGroupIds.has(group.id)

            return (
              <div 
                key={group.id} 
                data-group-card-id={group.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${group.id === highlightedGroupId ? styles.highlightedGroupCard : ''}`} 
                style={{ '--group-border-color': group.color || '#3b82f6' } as React.CSSProperties}
                onClick={() => onSelectGroup(group)}
              >
                <div className={styles.cardHeader}>
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
                      setSelectedGroupIds(prev => {
                        const next = new Set(prev)
                        if (next.has(group.id)) {
                          next.delete(group.id)
                        } else {
                          next.add(group.id)
                        }
                        return next
                      })
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => {}} 
                      style={{ width: '14px', height: '14px', cursor: 'pointer', margin: 0, pointerEvents: 'none' }}
                    />
                  </div>
                  <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span 
                      className={styles.colorIndicator} 
                      style={{ backgroundColor: group.color || '#3b82f6', display: 'inline-block' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.name}
                    </span>
                  </h3>
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
                      <div className={styles.cardContentLabel}>{t(group.content_type || 'no content')}</div>
                      <div className={styles.cardContentName} title={contentName} style={{ display: 'flex', minWidth: 0 }}>
                        <FilenameTruncator filename={contentName} />
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardStatusRow}>
                    <span className={styles.cardStatus}>
                      <span className={styles.statusDotOnline} /> {onlineCount} {t('online')}
                    </span>
                    <span className={styles.cardStatus}>
                      <span className={styles.statusDotOffline} /> {offlineCount} {t('offline')}
                    </span>
                  </div>
                </div>

                <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                  <button 
                    className={styles.cardBtn} 
                    onClick={() => onSelectGroup(group)}
                  >
                    {t('Edit Group')}
                  </button>
                  <button 
                    className={`${styles.cardBtn} ${styles.cardBtnDanger}`} 
                    onClick={() => onDeleteGroup(group)}
                  >
                    {t('Delete')}
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
            {t('Showing {start} to {end} of {total} groups', { start: startItem, end: endItem, total: filteredGroups.length })}
          </div>
          <div className={styles.footerControls}>
            <div className={styles.perPageSelector}>
              <span>{t('Per page:')}</span>
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
                {t('Page {current} of {total}', { current: currentPage, total: totalPages })}
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
      {/* Custom Confirmation Dialog for bulk deleting groups */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleConfirmDeleteSelectedGroups}
        title={t('Delete Screen Groups')}
        description={t('Are you sure you want to delete the {count} selected group(s)?', { count: selectedGroupIds.size })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
      />
    </div>
  )
}
