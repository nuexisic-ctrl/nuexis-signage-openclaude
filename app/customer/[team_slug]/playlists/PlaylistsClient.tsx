'use client'

import { useState } from 'react'
import { Plus, ListVideo, Trash2, X, Image as ImageIcon, Video, Clock } from 'lucide-react'
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

  const handleSave = async () => {
    if (!newPlaylistName.trim()) return
    setIsSaving(true)
    try {
      if (editingPlaylistId) {
        await updatePlaylist(editingPlaylistId, newPlaylistName, teamSlug, items)
        setPlaylists(playlists.map(p => p.id === editingPlaylistId ? { ...p, name: newPlaylistName } : p))
        
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
        const created = await createPlaylist(teamId, newPlaylistName, teamSlug, items)
        setPlaylists([{ id: created.id, name: newPlaylistName, created_at: new Date().toISOString() }, ...playlists])
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

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Playlists</h1>
          <p className={styles.pageSubtitle}>Create and schedule dynamic playback loops</p>
        </div>
        <div className={styles.topbarActions}>
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

      {playlists.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <ListVideo size={24} />
          </div>
          <h3 className={styles.emptyTitle}>No Playlists Yet</h3>
          <p className={styles.emptyText}>Create your first playlist to mix images, videos, and dynamic widgets together.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {playlists.map((playlist) => (
            <div key={playlist.id} className={styles.playlistCard} onClick={() => handleEdit(playlist)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '42px', height: '42px', borderRadius: '12px', 
                    background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)'
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
                  style={{ background: 'transparent', border: 0, color: 'var(--on-surface-muted)', cursor: 'pointer', padding: '6px' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
