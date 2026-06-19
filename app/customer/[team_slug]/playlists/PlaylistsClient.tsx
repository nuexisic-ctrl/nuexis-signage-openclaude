'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ListVideo, Trash2, Clock, RefreshCw, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './playlists.module.css'
import { createPlaylist, deletePlaylist } from './actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/app/components/Toast'
import { useTranslation } from '@/lib/i18n'

interface PlaylistsClientProps {
  initialPlaylists: any[]
  teamSlug: string
  teamId: string
}

export default function PlaylistsClient({ initialPlaylists, teamSlug, teamId }: PlaylistsClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [isCreating, setIsCreating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

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

  const handleNewPlaylist = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const result = await createPlaylist(teamId, 'Untitled Playlist', teamSlug, [])
      if (result?.id) {
        toast.success(t('Playlist created'))
        router.push(`/customer/${teamSlug}/playlists/${result.id}`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to create playlist'))
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const targetName = playlists.find(p => p.id === id)?.name || 'Playlist'
    if (!confirm(t('Are you sure you want to delete the playlist "{name}"?', { name: targetName }))) return
    
    try {
      await deletePlaylist(id, teamSlug)
      setPlaylists(playlists.filter(p => p.id !== id))
      toast.success(t('Playlist "{name}" deleted successfully', { name: targetName }))
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to delete playlist'))
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
        <div>
          <h1 className={styles.pageTitle}>{t('Playlists')}</h1>
          <p className={styles.pageSubtitle}>{t('Create and schedule dynamic playback loops')}</p>
        </div>
        <div className={styles.topbarActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={t('Refresh Status')}
            title={t('Refresh Status')}
          >
            <RefreshCw size={20} className={isRefreshing ? styles.spin : ''} />
          </button>
          <button
            className={styles.addBtn}
            onClick={handleNewPlaylist}
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
                        background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)',
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
                      onClick={(e) => handleDelete(playlist.id, e)}
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
                    <tr key={playlist.id} className={styles.tableRow}>
                      <td>
                        <Link
                          href={`/customer/${teamSlug}/playlists/${playlist.id}`}
                          className={styles.playlistNameCell}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <div className={styles.playlistIconWrapper}>
                            <ListVideo size={18} />
                          </div>
                          <span className={styles.playlistNameText}>{playlist.name}</span>
                        </Link>
                      </td>
                      <td>{totalItems === 1 ? t('{count} item', { count: totalItems }) : t('{count} items', { count: totalItems })}</td>
                      <td>{formatPlaytime(totalDuration)}</td>
                      <td>{formatRelativeTime(playlist.updated_at)}</td>
                      <td>{new Date(playlist.created_at).toISOString().split('T')[0]}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionsGroup}>
                          <button 
                            onClick={(e) => handleDelete(playlist.id, e)}
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
          <div className={styles.tableFooter}>
            <div className={styles.paginationInfo}>
              {t('Showing {start} to {end} of {total} playlists', { start: startItem, end: endItem, total: filteredPlaylists.length })}
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
                    localStorage.setItem('nuexis_playlists_per_page', String(newLimit))
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
                  style={{ opacity: currentPage > 1 ? 1 : 0.5, cursor: currentPage > 1 ? 'pointer' : 'not-allowed' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  className={styles.pageBtn} 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{ opacity: currentPage < totalPages ? 1 : 0.5, cursor: currentPage < totalPages ? 'pointer' : 'not-allowed' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
