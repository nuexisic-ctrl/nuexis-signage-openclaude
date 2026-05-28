'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, ListVideo, Trash2, X, Clock, RefreshCw, LayoutGrid, List } from 'lucide-react'
import styles from './playlists.module.css'
import { createPlaylist, deletePlaylist, updatePlaylist, getPlaylistItems } from './actions'
import { createClient } from '@/lib/supabase/client'

interface PlaylistsClientProps {
  initialPlaylists: any[]
  assets: any[]
  teamSlug: string
  teamId: string
}

export default function PlaylistsClient({ initialPlaylists, assets, teamSlug, teamId }: PlaylistsClientProps) {
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Premium Dashboard States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [isMounted, setIsMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccessPulse, setShowSuccessPulse] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('playlistsViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('playlistsViewMode', mode)
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('playlists')
        .select('id, name, created_at, updated_at, playlist_items(duration_seconds)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!error && data) {
        await new Promise(resolve => setTimeout(resolve, 550))
        setPlaylists(data)
        setShowSuccessPulse(true)
        setTimeout(() => setShowSuccessPulse(false), 600)
      }
    } catch (err) {
      console.error('Error refreshing playlists:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSave = async () => {
    if (!newPlaylistName.trim()) return
    setIsSaving(true)
    try {
      if (editingPlaylistId) {
        await updatePlaylist(editingPlaylistId, newPlaylistName, teamSlug, items)
        
        // Broadcast refresh command to players using this playlist
        const supabase = createClient()
        const channel = supabase.channel(`playlist-broadcast-${editingPlaylistId}`)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'refresh',
              payload: { timestamp: Date.now() }
            })
            setTimeout(() => supabase.removeChannel(channel), 1000)
          }
        })
      } else {
        await createPlaylist(teamId, newPlaylistName, teamSlug, items)
      }

      // Re-fetch all playlists to reflect items changes and total play times
      const supabaseClient = createClient()
      const { data, error } = await supabaseClient
        .from('playlists')
        .select('id, name, created_at, updated_at, playlist_items(duration_seconds)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!error && data) {
        setPlaylists(data)
      }

      handleCloseModal()
    } catch (err) {
      console.error(err)
      alert(editingPlaylistId ? 'Failed to update playlist' : 'Failed to create playlist')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async (playlist: any) => {
    setNewPlaylistName(playlist.name)
    setEditingPlaylistId(playlist.id)
    setIsModalOpen(true)
    setIsLoadingItems(true)
    try {
      const fetchedItems = await getPlaylistItems(playlist.id)
      setItems(fetchedItems)
    } catch (err) {
      console.error(err)
      alert('Failed to load playlist items')
    } finally {
      setIsLoadingItems(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setNewPlaylistName('')
    setEditingPlaylistId(null)
    setItems([])
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this playlist?')) return
    
    try {
      await deletePlaylist(id, teamSlug)
      setPlaylists(playlists.filter(p => p.id !== id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete playlist')
    }
  }

  const handleAddItem = () => {
    setItems([...items, { type: 'image', asset_id: '', duration_seconds: 10, widget_type: '' }])
  }

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Auto-detect type if asset is selected
    if (field === 'asset_id' && value) {
      const asset = assets.find(a => a.id === value)
      if (asset) {
        newItems[index].type = asset.mime_type?.startsWith('video') ? 'video' : 'image'
      }
    }
    
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  // Playtime display formatting utility
  const formatPlaytime = (seconds: number) => {
    if (!seconds) return '0s'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m > 0) {
      return `${m}m ${s > 0 ? `${s}s` : ''}`
    }
    return `${s}s`
  }

  const filteredPlaylists = useMemo(() => {
    return playlists.filter(p => {
      const q = searchQuery.toLowerCase()
      return !searchQuery || p.name?.toLowerCase().includes(q)
    })
  }, [playlists, searchQuery])

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Playlists</h1>
          <p className={styles.pageSubtitle}>Create and schedule dynamic playback loops</p>
        </div>
        <div className={styles.topbarActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Status"
            title="Refresh Status"
          >
            <RefreshCw size={20} className={isRefreshing ? styles.spin : ''} />
          </button>
          <button className={styles.addBtn} onClick={() => {
            setEditingPlaylistId(null)
            setNewPlaylistName('')
            setItems([])
            setIsModalOpen(true)
          }}>
            <Plus size={18} className={styles.addBtnIcon} />
            New Playlist
          </button>
        </div>
      </div>

      <div className={styles.mainBlockContainer}>
        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input 
              type="text" 
              className={styles.searchInput}
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.controlsRight}>
            {isMounted && (
              <div className={styles.viewToggleGroup}>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('table')}
                  title="Table View"
                >
                  <List />
                </button>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.progressBarWrapper} ${isRefreshing ? styles.active : ''}`}>
          <div className={styles.progressBarLine} />
        </div>

        {!isMounted ? (
          <div className={styles.grid} style={{ opacity: 0 }}>
            <div style={{ height: '300px' }} />
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <ListVideo size={24} />
            </div>
            <h3 className={styles.emptyTitle}>No Playlists Found</h3>
            <p className={styles.emptyText}>
              {playlists.length === 0 
                ? 'Create your first playlist to mix images, videos, and dynamic widgets together.'
                : 'No playlists matched your search criteria.'
              }
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
            {filteredPlaylists.map((playlist) => {
              const playlistItems = playlist.playlist_items || []
              const totalItems = playlistItems.length
              const totalDuration = playlistItems.reduce((acc: number, item: any) => acc + (item.duration_seconds || 0), 0)

              return (
                <div key={playlist.id} className={styles.playlistCard} onClick={() => handleEdit(playlist)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '42px', height: '42px', borderRadius: '12px', 
                        background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)',
                        flexShrink: 0
                      }}>
                        <ListVideo size={20} />
                      </div>
                      <div>
                        <h3 className={styles.playlistName}>{playlist.name}</h3>
                        <div className={styles.playlistMeta}>
                          Created {new Date(playlist.created_at).toISOString().split('T')[0]}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(playlist.id, e)}
                      style={{ background: 'transparent', border: 0, color: 'var(--on-surface-muted)', cursor: 'pointer', padding: '6px', marginLeft: 'auto' }}
                      title="Delete Playlist"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className={styles.playlistStats}>
                    <span className={styles.statLabel}>
                      <ListVideo size={14} style={{ marginRight: '4px' }} />
                      {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
                    </span>
                    <span className={styles.statDot}>•</span>
                    <span className={styles.statLabel}>
                      <Clock size={14} style={{ marginRight: '4px' }} />
                      {formatPlaytime(totalDuration)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
            <table className={styles.playlistsTable}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th>Playlist Name</th>
                  <th>Total Items</th>
                  <th>Total Playtime</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlaylists.map((playlist) => {
                  const playlistItems = playlist.playlist_items || []
                  const totalItems = playlistItems.length
                  const totalDuration = playlistItems.reduce((acc: number, item: any) => acc + (item.duration_seconds || 0), 0)

                  return (
                    <tr key={playlist.id} className={styles.tableRow} onClick={() => handleEdit(playlist)}>
                      <td>
                        <div className={styles.playlistNameCell}>
                          <div className={styles.playlistIconWrapper}>
                            <ListVideo size={18} />
                          </div>
                          <span className={styles.playlistNameText}>{playlist.name}</span>
                        </div>
                      </td>
                      <td>{totalItems} {totalItems === 1 ? 'item' : 'items'}</td>
                      <td>{formatPlaytime(totalDuration)}</td>
                      <td>{new Date(playlist.created_at).toISOString().split('T')[0]}</td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={(e) => handleDelete(playlist.id, e)}
                          className={styles.deleteRowBtn}
                          title="Delete Playlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingPlaylistId ? 'Edit Playlist' : 'Create Playlist'}</h2>
              <button className={styles.closeBtn} onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Playlist Name</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="e.g. Lobby Morning Loop" 
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                <label className={styles.label}>Playlist Items</label>
                
                {isLoadingItems ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <p style={{ color: 'var(--on-surface-muted)', fontSize: '0.9rem' }}>Loading items...</p>
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed var(--outline-variant)', borderRadius: '10px' }}>
                    <p style={{ color: 'var(--on-surface-muted)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>No items in this playlist yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {items.map((item, idx) => (
                      <div key={idx} className={styles.itemEditorRow}>
                        <div style={{ width: '24px', color: 'var(--on-surface-muted)', fontWeight: 800, fontSize: '0.9rem' }}>
                          {idx + 1}.
                        </div>
                        <div className={styles.itemEditorControls}>
                          <select 
                            className={styles.itemSelect}
                            value={item.asset_id || ''}
                            onChange={(e) => handleUpdateItem(idx, 'asset_id', e.target.value)}
                          >
                            <option value="">Select Asset...</option>
                            {assets.map(a => (
                              <option key={a.id} value={a.id}>{a.file_name}</option>
                            ))}
                          </select>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={16} color="var(--on-surface-muted)" />
                            <input 
                              type="number" 
                              className={styles.durationInput} 
                              value={item.duration_seconds}
                              onChange={(e) => handleUpdateItem(idx, 'duration_seconds', parseInt(e.target.value) || 0)}
                              min={1}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-subtle)' }}>s</span>
                          </div>
                        </div>
                        <button className={styles.removeItemBtn} onClick={() => handleRemoveItem(idx)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <button className={styles.addItemBtn} onClick={handleAddItem} style={{ marginTop: '8px' }}>
                  <Plus size={16} /> Add Media Item
                </button>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={handleCloseModal}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={!newPlaylistName.trim() || isSaving || isLoadingItems}>
                {isSaving ? 'Saving...' : (editingPlaylistId ? 'Save Changes' : 'Create Playlist')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
