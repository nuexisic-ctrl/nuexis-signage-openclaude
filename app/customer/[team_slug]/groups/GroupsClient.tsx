'use client'

import React, { useState, useEffect, useTransition, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderTree, Plus, X, MoreVertical, Edit, Trash2, Users, Tv, 
  Image as ImageIcon, ListVideo, AlertTriangle, ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createGroup, renameGroup, deleteGroup } from './actions'
import { handleRangeSelection } from '@/lib/utils/selection'
import styles from './groups.module.css'
import { Group, Device, Membership } from './types'
import { ManageMembersModal } from './ManageMembersModal'
import { AssignContentModal } from './AssignContentModal'

interface Props {
  groups: Group[]
  devices: Device[]
  memberships: Membership[]
  assets: any[]
  playlists: any[]
  teamSlug: string
  teamId: string
}

const PRESET_COLORS = [
  '#000000', // black
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
  '#737373', // neutral
  '#525252', // neutral-dark
  '#64748b', // slate
  '#475569', // slate-dark
  '#334155', // slate-deep
]

export default function GroupsClient({
  groups: initialGroups,
  devices: initialDevices,
  memberships: initialMemberships,
  assets,
  playlists,
  teamSlug,
  teamId
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const createBackdropRef = useRef<HTMLDivElement>(null)
  const createStartedRef = useRef(false)
  const renameBackdropRef = useRef<HTMLDivElement>(null)
  const renameStartedRef = useRef(false)
  const deleteBackdropRef = useRef<HTMLDivElement>(null)
  const deleteStartedRef = useRef(false)

  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [memberships, setMemberships] = useState<Membership[]>(initialMemberships)

  // Modal Open States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [manageMembersGroup, setManageMembersGroup] = useState<Group | null>(null)
  const [assignContentGroup, setAssignContentGroup] = useState<Group | null>(null)
  const [renameGroupItem, setRenameGroupItem] = useState<Group | null>(null)
  const [deleteGroupItem, setDeleteGroupItem] = useState<Group | null>(null)

  // Input states
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(PRESET_COLORS[0])
  const [activeMenuGroupId, setActiveMenuGroupId] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Selection & Query States
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [lastSelectedGroupId, setLastSelectedGroupId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false)
  const selectDropdownRef = useRef<HTMLDivElement>(null)

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

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return groups.filter(g => !searchQuery || g.name.toLowerCase().includes(q))
  }, [groups, searchQuery])

  const handleToggleSelectGroup = (groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
        if (lastSelectedGroupId === groupId) {
          setLastSelectedGroupId(null)
        }
      } else {
        next.add(groupId)
        setLastSelectedGroupId(groupId)
      }
      return next
    })
  }

  const handleGroupCardDoubleClick = (e: React.MouseEvent, group: Group) => {
    const target = e.target as HTMLElement
    if (
      target.closest(`.${styles.cardCheckbox}`) ||
      target.closest(`.${styles.contextBtn}`) ||
      target.closest(`.${styles.menuOverlay}`) ||
      target.closest(`.${styles.cardFooter}`) ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return
    }
    e.preventDefault()
    setAssignContentGroup(group)
  }

  const handleGroupCardClick = (e: React.MouseEvent, groupId: string) => {
    const target = e.target as HTMLElement
    if (
      target.closest(`.${styles.cardCheckbox}`) ||
      target.closest(`.${styles.contextBtn}`) ||
      target.closest(`.${styles.menuOverlay}`) ||
      target.closest(`.${styles.cardFooter}`) ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return
    }
    e.preventDefault()

    if (selectedGroupIds.size === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const group = filteredGroups.find(g => g.id === groupId)
      if (group) {
        handleGroupCardDoubleClick(e, group)
      }
    } else {
      const { nextSelectedIds, nextLastSelectedId } = handleRangeSelection(
        e,
        groupId,
        lastSelectedGroupId,
        filteredGroups,
        selectedGroupIds
      )
      setSelectedGroupIds(nextSelectedIds)
      setLastSelectedGroupId(nextLastSelectedId)
    }
  }

  const handleBulkDelete = () => {
    const count = selectedGroupIds.size
    if (window.confirm(`Are you sure you want to delete the ${count} selected screen groups?`)) {
      startTransition(async () => {
        const ids = Array.from(selectedGroupIds)
        let successCount = 0
        let errorOccurred = false
        for (const id of ids) {
          const res = await deleteGroup(teamSlug, id)
          if (res.success) {
            successCount++
          } else {
            errorOccurred = true
          }
        }
        if (successCount > 0) {
          setSelectedGroupIds(new Set())
          router.refresh()
        }
        if (errorOccurred) {
          alert('Some groups could not be deleted.')
        }
      })
    }
  }

  // ── Postgres changes realtime subscription ──────────────────────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('groups-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_groups', filter: `team_id=eq.${teamId}` }, 
        async () => {
          // Re-fetch groups server-side via router refresh
          router.refresh()
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_group_members', filter: `team_id=eq.${teamId}` }, 
        async () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, router, supabase])

  // Sync state from server props when they update (realtime router.refresh triggers this)
  useEffect(() => {
    setGroups(initialGroups)
    setDevices(initialDevices)
    setMemberships(initialMemberships)
  }, [initialGroups, initialDevices, initialMemberships])

  // Handle outside clicks to close the context menus
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuGroupId(null)
    if (activeMenuGroupId) document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [activeMenuGroupId])

  // Create Group Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const res = await createGroup(teamSlug, groupName, groupColor)
      if (res.success) {
        setShowCreateModal(false)
        setGroupName('')
        setGroupColor(PRESET_COLORS[0])
        router.refresh()
      } else {
        setErrorMsg(res.error || 'Unknown error occurred')
      }
    })
  }

  // Rename Group Submit
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameGroupItem) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await renameGroup(teamSlug, renameGroupItem.id, groupName)
      if (res.success) {
        setRenameGroupItem(null)
        setGroupName('')
        router.refresh()
      } else {
        setErrorMsg(res.error || 'Unknown error occurred')
      }
    })
  }

  // Delete Group Submit
  const handleDeleteSubmit = () => {
    if (!deleteGroupItem) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await deleteGroup(teamSlug, deleteGroupItem.id)
      if (res.success) {
        setDeleteGroupItem(null)
        router.refresh()
      } else {
        setErrorMsg(res.error || 'Unknown error occurred')
      }
    })
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Screen Groups</h1>
          <p className={styles.pageSubtitle}>
            Manage multiple screens in bulk and inherit content settings.
          </p>
        </div>
        <div className={styles.topbarActions}>
          <button className={styles.addBtn} onClick={() => {
            setGroupName('')
            setGroupColor(PRESET_COLORS[0])
            setErrorMsg(null)
            setShowCreateModal(true)
          }}>
            <Plus size={18} />
            New Group
          </button>
        </div>
      </div>

      <div className={styles.contentContainer}>
        {groups.length > 0 && (
          <div className={styles.controlsBar}>
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
                  aria-label="Select all groups"
                  className={styles.globalSelectCheckbox}
                />
                <button
                  type="button"
                  onClick={() => setIsSelectDropdownOpen(!isSelectDropdownOpen)}
                  className={styles.globalSelectDropdownBtn}
                  aria-label="Open selection menu"
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
                      Select All ({filteredGroups.length})
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
                      Deselect All
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
                  placeholder="Search groups by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search groups"
                />
              </div>
            </div>
            <div className={styles.controlsRight}>
              {selectedGroupIds.size > 0 && (
                <div className={styles.selectedActionsContainer}>
                  <div className={styles.selectedCountBadge} title={`${selectedGroupIds.size} groups selected`}>
                    <span className={styles.selectedCountNumber}>{selectedGroupIds.size}</span>
                    <span className={styles.selectedCountText}>Selected</span>
                  </div>
                  <button
                    className={`${styles.bulkActionIconBtn} ${styles.bulkActionIconBtnDanger}`}
                    onClick={handleBulkDelete}
                    title="Delete Selected Groups"
                    disabled={isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FolderTree size={28} />
            </div>
            <h3 className={styles.emptyTitle}>No screen groups yet</h3>
            <p className={styles.emptyText}>
              Create a group to organize your displays, then assign content to all screens in the group at once.
            </p>
            <button className={styles.addBtn} onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              Create First Group
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FolderTree size={28} />
            </div>
            <h3 className={styles.emptyTitle}>No screen groups found</h3>
            <p className={styles.emptyText}>
              No screen groups matched your search criteria.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredGroups.map((group) => {
              const groupMemberships = memberships.filter(m => m.group_id === group.id)
              const memberIds = groupMemberships.map(m => m.device_id)
              const memberDevices = devices.filter(d => memberIds.includes(d.id))
              const onlineCount = memberDevices.filter(d => d.status === 'online').length
              const offlineCount = memberDevices.length - onlineCount

              // Resolve content names
              let contentName = 'no content'
              if (group.content_type === 'Asset') {
                const ast = assets.find(a => a.id === group.asset_id)
                contentName = ast ? ast.file_name : 'no content'
              } else if (group.content_type === 'Playlist') {
                const pl = playlists.find(p => p.id === group.playlist_id)
                contentName = pl ? pl.name : 'no content'
              }

              return (
                <div 
                  key={group.id} 
                  className={`${styles.card} ${selectedGroupIds.has(group.id) ? styles.cardSelected : ''}`}
                  onClick={(e) => handleGroupCardClick(e, group.id)}
                  onDoubleClick={(e) => handleGroupCardDoubleClick(e, group)}
                >
                  <div className={styles.colorBar} style={{ backgroundColor: group.color || '#3b82f6' }} />
                  
                  <div className={styles.cardHeader}>
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={() => handleToggleSelectGroup(group.id)}
                      className={styles.cardCheckbox}
                      aria-label={`Select group ${group.name}`}
                    />
                    <div className={styles.groupInfo}>
                      <h3 className={styles.groupName}>{group.name}</h3>
                      <div className={styles.memberCountBadge}>
                        <Users size={12} />
                        {memberDevices.length} {memberDevices.length === 1 ? 'screen' : 'screens'}
                      </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button className={styles.contextBtn} onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuGroupId(activeMenuGroupId === group.id ? null : group.id)
                      }}>
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuGroupId === group.id && (
                        <div className={styles.menuOverlay} onClick={(e) => e.stopPropagation()}>
                          <button className={styles.menuItem} onClick={() => {
                            setGroupName(group.name)
                            setRenameGroupItem(group)
                            setErrorMsg(null)
                            setActiveMenuGroupId(null)
                          }}>
                            <Edit size={14} /> Rename
                          </button>
                          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => {
                            setDeleteGroupItem(group)
                            setErrorMsg(null)
                            setActiveMenuGroupId(null)
                          }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.contentPreview}>
                      {group.content_type ? (
                        <>
                          <div className={styles.contentThumb}>
                            {group.content_type === 'Playlist' ? <ListVideo size={16} /> : <ImageIcon size={16} />}
                          </div>
                          <div className={styles.contentText}>
                            <div className={styles.contentLabel}>{group.content_type}</div>
                            <div className={styles.contentName} title={contentName}>{contentName}</div>
                          </div>
                        </>
                      ) : (
                        <div className={styles.contentText} style={{ fontStyle: 'italic', color: 'var(--on-surface-subtle)' }}>
                          no content
                        </div>
                      )}
                    </div>

                    <div className={styles.statsMini}>
                      <span>
                        <span className={`${styles.statusDot} ${styles.online}`} /> {onlineCount} online
                      </span>
                      <span>
                        <span className={`${styles.statusDot} ${styles.offline}`} /> {offlineCount} offline
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <button 
                      className={`${styles.footerBtn} ${styles.footerBtnPrimary}`}
                      onClick={() => setAssignContentGroup(group)}
                    >
                      <Tv size={14} /> Content
                    </button>
                    <button 
                      className={styles.footerBtn}
                      onClick={() => setManageMembersGroup(group)}
                    >
                      <Users size={14} /> Screens
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div 
          ref={createBackdropRef}
          className={styles.modalBackdrop} 
          onMouseDown={(e) => {
            createStartedRef.current = e.target === createBackdropRef.current
          }}
          onClick={() => {
            if (createStartedRef.current) {
              setShowCreateModal(false)
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Screen Group</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Group Name</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    className={styles.formInput}
                    placeholder="E.g., Airport Terminal, Retail Front"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Group Color Tag</label>
                  <div className={styles.colorPickerGrid}>
                    {PRESET_COLORS.map(c => (
                      <div
                        key={c}
                        className={`${styles.colorOption} ${groupColor === c ? styles.colorOptionSelected : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setGroupColor(c)}
                      />
                    ))}
                  </div>
                </div>
                {errorMsg && <div className={styles.errorText} style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />{errorMsg}</div>}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btn} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
                  {isPending ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameGroupItem && (
        <div 
          ref={renameBackdropRef}
          className={styles.modalBackdrop} 
          onMouseDown={(e) => {
            renameStartedRef.current = e.target === renameBackdropRef.current
          }}
          onClick={() => {
            if (renameStartedRef.current) {
              setRenameGroupItem(null)
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Rename Screen Group</h2>
              <button className={styles.closeBtn} onClick={() => setRenameGroupItem(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Group Name</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    className={styles.formInput}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                {errorMsg && <div className={styles.errorText} style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />{errorMsg}</div>}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btn} onClick={() => setRenameGroupItem(null)}>Cancel</button>
                <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
                  {isPending ? 'Saving…' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteGroupItem && (
        <div 
          ref={deleteBackdropRef}
          className={styles.modalBackdrop} 
          onMouseDown={(e) => {
            deleteStartedRef.current = e.target === deleteBackdropRef.current
          }}
          onClick={() => {
            if (deleteStartedRef.current) {
              setDeleteGroupItem(null)
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Delete Screen Group</h2>
              <button className={styles.closeBtn} onClick={() => setDeleteGroupItem(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.92rem', color: 'var(--on-surface-muted)' }}>
                Are you sure you want to delete the group <strong>{deleteGroupItem.name}</strong>?
              </p>
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: '0.825rem', color: '#dc2626' }}>
                  Screens belonging to this group will automatically lose their group membership and fallback to their own individual content, or revert to the idle pairing screen if unassigned.
                </span>
              </div>
              {errorMsg && <div className={styles.errorText} style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />{errorMsg}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btn} onClick={() => setDeleteGroupItem(null)}>Cancel</button>
              <button type="button" disabled={isPending} className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeleteSubmit}>
                {isPending ? 'Deleting…' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE MEMBERS MODAL */}
      {manageMembersGroup && (
        <ManageMembersModal
          group={manageMembersGroup}
          devices={devices}
          memberships={memberships}
          teamSlug={teamSlug}
          onClose={() => setManageMembersGroup(null)}
          router={router}
        />
      )}

      {/* ASSIGN CONTENT MODAL */}
      {assignContentGroup && (
        <AssignContentModal
          group={assignContentGroup}
          assets={assets}
          playlists={playlists}
          teamSlug={teamSlug}
          onClose={() => setAssignContentGroup(null)}
          router={router}
        />
      )}
    </>
  )
}

