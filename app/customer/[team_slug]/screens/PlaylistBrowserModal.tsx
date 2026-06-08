'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, LayoutGrid, List, ChevronLeft, ChevronRight, ListVideo, Clock, Calendar } from 'lucide-react'
import styles from '../components/AssetBrowser/AssetBrowser.module.css'
import { Playlist } from './types'
import { modalStack } from '@/lib/utils/modalStack'

export interface PlaylistBrowserModalProps {
  playlists: Playlist[]
  onClose: () => void
  onSelect: (playlistId: string) => void
}

export function PlaylistBrowserModal({
  playlists,
  onClose,
  onSelect,
}: PlaylistBrowserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('playlistBrowserViewMode')
      if (saved === 'grid' || saved === 'table') return saved
    }
    return 'table'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('playlistBrowserViewMode', mode)
  }

  // Lock body scroll when modal is open, register with modalStack, and handle Escape key to close
  useEffect(() => {
    modalStack.push('playlist-browser-modal')
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalStack.isTop('playlist-browser-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      modalStack.pop('playlist-browser-modal')
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Formatting helpers
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'May 28, 2026'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'May 28, 2026'
    }
  }

  const formatPlaytime = (seconds: number) => {
    if (!seconds) return '0s'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m > 0) {
      return `${m}m ${s > 0 ? `${s}s` : ''}`
    }
    return `${s}s`
  }

  // Filter & Search Logic
  const filteredPlaylists = useMemo(() => {
    return playlists.filter((playlist) => {
      return playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [playlists, searchQuery])

  // Pagination Logic
  const totalItems = filteredPlaylists.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const paginatedPlaylists = useMemo(() => {
    const fromIndex = (currentPage - 1) * pageSize
    return filteredPlaylists.slice(fromIndex, fromIndex + pageSize)
  }, [filteredPlaylists, currentPage])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  return (
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Playlist</h3>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close browser">
              <X size={16} />
            </button>
          </div>
          
          <div className={styles.controlsRow}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by content loop name..."
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
              />
            </div>
            
            <div className={styles.actionsRight}>
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
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {paginatedPlaylists.length === 0 ? (
            <div className={styles.emptyState}>
              <h4 className={styles.emptyText}>No content loops match your query.</h4>
            </div>
          ) : viewMode === 'table' ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Playlist Name</th>
                    <th>Total Items</th>
                    <th>Total Playtime</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPlaylists.map((playlist) => {
                    const itemsList = playlist.playlist_items || []
                    const totalDuration = itemsList.reduce((acc, item) => acc + (item.duration_seconds || 0), 0)
                    
                    return (
                      <tr
                        key={playlist.id}
                        className={styles.row}
                        onClick={() => onSelect(playlist.id)}
                      >
                        <td>
                          <div className={styles.fileNameCell}>
                            <div className={styles.fileIconWrapper}>
                              <ListVideo size={18} />
                            </div>
                            <span className={styles.fileNameText}>{playlist.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.typeBadge}>
                            {itemsList.length} {itemsList.length === 1 ? 'ITEM' : 'ITEMS'}
                          </span>
                        </td>
                        <td>{formatPlaytime(totalDuration)}</td>
                        <td>{formatDate(playlist.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.grid}>
              {paginatedPlaylists.map((playlist) => {
                const itemsList = playlist.playlist_items || []
                const totalDuration = itemsList.reduce((acc, item) => acc + (item.duration_seconds || 0), 0)

                return (
                  <div
                    key={playlist.id}
                    className={styles.card}
                    onClick={() => onSelect(playlist.id)}
                  >
                    <div className={styles.cardPreviewBox} style={{ background: 'var(--surface-low)', height: '100px' }}>
                      <ListVideo size={32} className={styles.cardPreviewIcon} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                      <span className={`${styles.typeBadge} ${styles.cardTypeBadge}`}>
                        {itemsList.length} {itemsList.length === 1 ? 'ITEM' : 'ITEMS'}
                      </span>
                    </div>
                    <div className={styles.cardBody} style={{ minHeight: '80px' }}>
                      <h4 className={styles.cardTitle} title={playlist.name}>
                        {playlist.name}
                      </h4>
                      <div className={styles.cardDetails} style={{ marginTop: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {formatPlaytime(totalDuration)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Calendar size={12} /> {formatDate(playlist.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div>
            Showing {startItem} to {endItem} of {totalItems} content loops
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.pageBtn} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
