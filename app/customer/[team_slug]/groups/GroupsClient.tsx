'use client'

import React, { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderTree, Plus, X, MoreVertical, Edit, Trash2, Users, Tv, 
  Image as ImageIcon, ListVideo, AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createGroup, renameGroup, deleteGroup } from './actions'
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

  const isMountedRef = useRef(false)

  // Sync state from server props when they update (only on first mount or careful merge)
  useEffect(() => {
    if (!isMountedRef.current) {
      setGroups(initialGroups)
      setDevices(initialDevices)
      setMemberships(initialMemberships)
      isMountedRef.current = true
    } else {
      // Merge only truly new groups
      setGroups(prev => {
        const existingIds = new Set(prev.map(g => g.id))
        const missing = initialGroups.filter(g => !existingIds.has(g.id))
        if (missing.length > 0) return [...missing, ...prev]
        return prev
      })
      // Sync devices since they might have changed assignments
      setDevices(prev => {
        const existingIds = new Set(prev.map(d => d.id))
        const missing = initialDevices.filter(d => !existingIds.has(d.id))
        if (missing.length > 0) return [...missing, ...prev]
        return prev
      })
      // Memberships are tricky to merge, we will overwrite if we aren't doing direct realtime merges
      setMemberships(initialMemberships)
    }
  }, [initialGroups, initialDevices, initialMemberships])

  // ── Postgres changes realtime subscription ──────────────────────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('groups-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_groups', filter: `team_id=eq.${teamId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setGroups(prev => {
              const existing = new Set(prev.map(g => g.id))
              if (!existing.has(payload.new.id)) return [payload.new as Group, ...prev]
              return prev
            })
          } else if (payload.eventType === 'UPDATE') {
            setGroups(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } as Group : g))
          } else if (payload.eventType === 'DELETE') {
            setGroups(prev => prev.filter(g => g.id !== payload.old.id))
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_group_members', filter: `team_id=eq.${teamId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMemberships(prev => {
              const existing = prev.some(m => m.group_id === payload.new.group_id && m.device_id === payload.new.device_id)
              if (!existing) return [payload.new as Membership, ...prev]
              return prev
            })
          } else if (payload.eventType === 'DELETE') {
            setMemberships(prev => prev.filter(m => !(m.group_id === payload.old.group_id && m.device_id === payload.old.device_id)))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, supabase])

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
        ) : (
          <div className={styles.grid}>
            {groups.map((group) => {
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
                <div key={group.id} className={styles.card}>
                  <div className={styles.colorBar} style={{ backgroundColor: group.color || '#3b82f6' }} />
                  
                  <div className={styles.cardHeader}>
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

