'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ListVideo, Trash2, Clock, RefreshCw, LayoutGrid, List, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import styles from './playlists.module.css'
import { createPlaylist, deletePlaylist } from './actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/app/components/Toast'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n'
import Pagination from '../components/Pagination'
import { PRESET_COLORS } from '@/lib/utils/constants'

interface PlaylistsClientProps {
  initialPlaylists: any[]
  teamSlug: string
  teamId: string
}

export default function PlaylistsClient({ initialPlaylists, teamSlug, teamId }: PlaylistsClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistColor, setNewPlaylistColor] = useState(PRESET_COLORS[0])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showColorPicker) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setTimeout(() => {
          setShowColorPicker(false)
        }, 120)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showColorPicker])

  useEffect(() => {
    const savedLimit = localStorage.getItem('nuexis_playlists_per_page')
    if (savedLimit) {
      setPageSize(Number(savedLimit) || 10)
    }
  }, [])

  // View mode state
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
        .select('id, name, color, created_at, updated_at, playlist_items(duration_seconds)')
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

  const handleNewPlaylistClick = () => {
    setNewPlaylistName('')
    setNewPlaylistColor(PRESET_COLORS[0])
    setShowColorPicker(false)
    setShowCreateModal(true)
  }

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameTrimmed = newPlaylistName.trim()
    if (!nameTrimmed) return
    if (isCreating) return
    setIsCreating(true)
    try {
      const result = await createPlaylist(teamId, nameTrimmed, teamSlug, [], newPlaylistColor)
      if (result?.id) {
        toast.success(t('Playlist created'))
        setShowCreateModal(false)
        router.push(`/customer/${teamSlug}/playlists/${result.id}`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to create playlist'))
      setIsCreating(false)
    }
  }

  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDeleteTarget({ id, name })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { id, name } = deleteTarget
    try {
      await deletePlaylist(id, teamSlug)
      setPlaylists(playlists.filter(p => p.id !== id))
      toast.success(t('Playlist "{name}" deleted successfully', { name }))
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to delete playlist'))
    } finally {
      setDeleteTarget(null)
    }
  }

  // Playtime display formatting utility
  const formatPlaytime = (seconds: number) => {
    if (!seconds) return '0s'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m > 0) {
      return t('{m}m {s}s', { m, s: s > 0 ? `${s}` : '' }).trim()
    }
    return t('{s}s', { s })
  }

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t('Just now')
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`
    return date.toLocaleDateString()
  }

  const filteredPlaylists = useMemo(() => {
    return playlists.filter(p => {
      const q = searchQuery.toLowerCase()
      return !searchQuery || p.name?.toLowerCase().includes(q)
    })
  }, [playlists, searchQuery])

  const totalPages = Math.ceil(filteredPlaylists.length / pageSize) || 1

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [filteredPlaylists, currentPage, totalPages])

  const paginatedPlaylists = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return filteredPlaylists.slice(from, from + pageSize)
  }, [filteredPlaylists, currentPage, pageSize])

  const startItem = filteredPlaylists.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredPlaylists.length)

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.titleContainer}>
          <h1 className={styles.pageTitle}>{t('Playlists')}</h1>
          <button
            className={styles.headerRefreshBtn}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={t('Refresh Status')}
            title={t('Refresh Status')}
            type="button"
          >
            <RefreshCw size={16} className={isRefreshing ? styles.spin : ''} />
          </button>
        </div>
        <div className={styles.topbarActions}>
          <button
            className={styles.addBtn}
            onClick={handleNewPlaylistClick}
            disabled={isCreating}
          >
            <Plus size={18} className={styles.addBtnIcon} />
            {isCreating ? t('Creating...') : t('New Playlist')}
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
              placeholder={t('Search playlists...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className={styles.controlsRight}>
            {isMounted && (
              <div className={styles.viewToggleGroup}>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('table')}
                  title={t('Table View')}
                >
                  <List />
                </button>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                  onClick={() => handleSetViewMode('grid')}
                  title={t('Grid View')}
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

        {filteredPlaylists.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <ListVideo size={24} />
            </div>
            <h3 className={styles.emptyTitle}>{t('No Playlists Found')}</h3>
            <p className={styles.emptyText}>
              {playlists.length === 0 
                ? t('Create your first playlist to mix images, videos, and dynamic widgets together.')
                : t('No playlists matched your search criteria.')
              }
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
            {paginatedPlaylists.map((playlist) => {
              const playlistItems = playlist.playlist_items || []
              const totalItems = playlistItems.length
              const totalDuration = playlistItems.reduce((acc: number, item: any) => acc + (item.duration_seconds || 0), 0)

              return (
                <Link
                  key={playlist.id}
                  href={`/customer/${teamSlug}/playlists/${playlist.id}`}
                  className={styles.playlistCard}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '42px', height: '42px', borderRadius: '12px', 
                        background: 'var(--surface-low)', 
                        border: `1.5px solid ${playlist.color || 'var(--outline-variant)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: playlist.color || 'var(--on-surface-muted)',
                        flexShrink: 0
                      }}>
                        <ListVideo size={20} />
                      </div>
                      <div>
                        <h3 className={styles.playlistName}>{playlist.name}</h3>
                        <div className={styles.playlistMeta}>
                          {formatRelativeTime(playlist.updated_at)}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteClick(playlist.id, playlist.name, e)}
                      style={{ background: 'transparent', border: 0, color: 'var(--on-surface-muted)', cursor: 'pointer', padding: '6px', marginLeft: 'auto' }}
                      title={t('Delete Playlist')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className={styles.playlistStats}>
                    <span className={styles.statLabel}>
                      <ListVideo size={14} style={{ marginRight: '4px' }} />
                      {totalItems === 1 ? t('{count} Item', { count: totalItems }) : t('{count} Items', { count: totalItems })}
                    </span>
                    <span className={styles.statDot}>•</span>
                    <span className={styles.statLabel}>
                      <Clock size={14} style={{ marginRight: '4px' }} />
                      {formatPlaytime(totalDuration)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
            <table className={styles.playlistsTable}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th>{t('Playlist Name')}</th>
                  <th>{t('Total Items')}</th>
                  <th>{t('Total Playtime')}</th>
                  <th>{t('Last Updated')}</th>
                  <th>{t('Created Date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlaylists.map((playlist) => {
                  const playlistItems = playlist.playlist_items || []
                  const totalItems = playlistItems.length
                  const totalDuration = playlistItems.reduce((acc: number, item: any) => acc + (item.duration_seconds || 0), 0)

                  return (
                    <tr 
                      key={playlist.id} 
                      className={styles.tableRow}
                      onClick={() => router.push(`/customer/${teamSlug}/playlists/${playlist.id}`)}
                    >
                      <td>
                        <div className={styles.playlistNameCell}>
                          <div 
                            className={styles.playlistIconWrapper}
                            style={{ 
                              border: `1.5px solid ${playlist.color || 'var(--outline-variant)'}`, 
                              color: playlist.color || 'var(--on-surface-muted)' 
                            }}
                          >
                            <ListVideo size={18} />
                          </div>
                          <span className={styles.playlistNameText}>{playlist.name}</span>
                        </div>
                      </td>
                      <td>{totalItems === 1 ? t('{count} item', { count: totalItems }) : t('{count} items', { count: totalItems })}</td>
                      <td>{formatPlaytime(totalDuration)}</td>
                      <td>{formatRelativeTime(playlist.updated_at)}</td>
                      <td>{new Date(playlist.created_at).toISOString().split('T')[0]}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionsGroup}>
                          <button 
                            onClick={(e) => handleDeleteClick(playlist.id, playlist.name, e)}
                            className={styles.deleteRowBtn}
                            title={t('Delete Playlist')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {playlists.length > 0 && filteredPlaylists.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredPlaylists.length}
            onPageChange={(page, size) => {
              setCurrentPage(page)
              if (size !== pageSize) {
                setPageSize(size)
                localStorage.setItem('nuexis_playlists_per_page', String(size))
              }
            }}
            itemLabel="playlists"
          />
        )}
      </div>

      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={`${styles.modalContent} ${styles.createModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t('New Playlist')}</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)} aria-label={t('Close modal')}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmCreate}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="new-playlist-name">{t('Playlist Name')}</label>
                  <div className={styles.inputWithColorContainer}>
                    <input
                      id="new-playlist-name"
                      type="text"
                      className={styles.inputWithColor}
                      placeholder={t('e.g. Lobby Morning Loop')}
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      maxLength={200}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.colorIndicatorDot}
                      style={{ backgroundColor: newPlaylistColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      title={t('Select Playlist Color')}
                      aria-label={t('Select Playlist Color')}
                    />
                    {showColorPicker && (
                      <div className={styles.colorPickerPopover} ref={colorPickerRef}>
                        <div className={styles.popoverHeader}>
                          <span className={styles.popoverTitle}>{t('Select Color')}</span>
                          <button 
                            type="button" 
                            className={styles.popoverCloseBtn} 
                            onClick={() => setShowColorPicker(false)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        
                        <div className={styles.predefinedColorsGrid}>
                          {PRESET_COLORS.map((c) => {
                            const isSelected = newPlaylistColor === c
                            return (
                              <button
                                type="button"
                                key={c}
                                className={`${styles.colorOptionBubble} ${isSelected ? styles.colorOptionBubbleSelected : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => {
                                  setNewPlaylistColor(c)
                                  setShowColorPicker(false)
                                }}
                              >
                                {isSelected && <Check size={10} style={{ color: c === '#ffffff' ? '#000' : '#fff' }} />}
                              </button>
                            )
                          })}
                        </div>
                        
                        <div className={styles.customColorSection}>
                          <label className={styles.customColorLabel}>{t('Custom Color')}</label>
                          <div className={styles.customColorRow}>
                            <input
                              type="color"
                              className={styles.customColorInput}
                              value={newPlaylistColor}
                              onChange={(e) => setNewPlaylistColor(e.target.value)}
                            />
                            <input
                              type="text"
                              className={styles.customColorHexInput}
                              value={newPlaylistColor}
                              onChange={(e) => setNewPlaylistColor(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                  {t('Cancel')}
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isCreating || !newPlaylistName.trim()}>
                  {isCreating ? t('Creating...') : t('Create Playlist')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for deleting playlist */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('Delete Playlist')}
        description={t('Are you sure you want to delete the playlist "{name}"?', { name: deleteTarget?.name || '' })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
      />
    </>
  )
}
