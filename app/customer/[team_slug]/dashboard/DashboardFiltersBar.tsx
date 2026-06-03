'use client'

import { useMemo } from 'react'
import { X, Filter } from 'lucide-react'
import styles from './dashboard.module.css'
import type { PlaylistOption, AssetOption } from './actions'

export type DashboardFilters = {
  query: string
  status: 'all' | 'online' | 'offline' | 'pairing'
  contentType: 'all' | 'Asset' | 'Playlist' | 'None'
  playlistId: 'all' | string
  assetId: 'all' | string
}

interface Props {
  playlistOptions: PlaylistOption[]
  assetOptions: AssetOption[]
  value: DashboardFilters
  onChange: (next: DashboardFilters) => void
}

export default function DashboardFiltersBar({ playlistOptions, assetOptions, value, onChange }: Props) {
  const chips = useMemo(() => {
    const out: Array<{ key: keyof DashboardFilters; label: string; clearTo: DashboardFilters[keyof DashboardFilters] }> = []
    if (value.status !== 'all') out.push({ key: 'status', label: `Status: ${value.status}`, clearTo: 'all' })
    if (value.contentType !== 'all') out.push({ key: 'contentType', label: `Content: ${value.contentType}`, clearTo: 'all' })
    if (value.playlistId !== 'all') {
      const name = playlistOptions.find(p => p.id === value.playlistId)?.name ?? 'Playlist'
      out.push({ key: 'playlistId', label: `Playlist: ${name}`, clearTo: 'all' })
    }
    if (value.assetId !== 'all') {
      const name = assetOptions.find(a => a.id === value.assetId)?.fileName ?? 'Asset'
      out.push({ key: 'assetId', label: `Asset: ${name}`, clearTo: 'all' })
    }
    if (value.query.trim()) out.push({ key: 'query', label: `Search: "${value.query.trim()}"`, clearTo: '' })
    return out
  }, [assetOptions, playlistOptions, value])

  const hasActive = chips.length > 0

  function patch<K extends keyof DashboardFilters>(key: K, v: DashboardFilters[K]) {
    onChange({ ...value, [key]: v })
  }

  function reset() {
    onChange({ query: '', status: 'all', contentType: 'all', playlistId: 'all', assetId: 'all' })
  }

  return (
    <div className={styles.filtersBar} aria-label="Dashboard filters">
      <div className={styles.filtersRow}>
        <div className={styles.filtersLeft}>
          <div className={styles.filterSearch}>
            <Filter size={16} />
            <input
              className={styles.filterSearchInput}
              value={value.query}
              onChange={(e) => patch('query', e.target.value)}
              placeholder="Search screens, playlists, assets…"
              aria-label="Search"
            />
          </div>

          <select
            className={styles.filterSelect}
            value={value.status}
            onChange={(e) => patch('status', e.target.value as DashboardFilters['status'])}
            aria-label="Status"
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="pairing">Pairing</option>
          </select>

          <select
            className={styles.filterSelect}
            value={value.contentType}
            onChange={(e) => patch('contentType', e.target.value as DashboardFilters['contentType'])}
            aria-label="Content type"
          >
            <option value="all">All content</option>
            <option value="Playlist">Playlist</option>
            <option value="Asset">Asset</option>
            <option value="None">no content</option>
          </select>

          <select
            className={styles.filterSelect}
            value={value.playlistId}
            onChange={(e) => patch('playlistId', e.target.value as DashboardFilters['playlistId'])}
            aria-label="Playlist"
          >
            <option value="all">All playlists</option>
            {playlistOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={value.assetId}
            onChange={(e) => patch('assetId', e.target.value as DashboardFilters['assetId'])}
            aria-label="Asset"
          >
            <option value="all">All assets</option>
            {assetOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.fileName}</option>
            ))}
          </select>
        </div>

        <div className={styles.filtersRight}>
          <button
            className={styles.filtersResetBtn}
            onClick={reset}
            disabled={!hasActive}
            title="Reset filters"
          >
            Reset
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.filterChips} aria-label="Active filters">
          {chips.map((c) => (
            <button
              key={`${c.key}:${c.label}`}
              className={styles.filterChip}
              onClick={() => patch(c.key, c.clearTo as never)}
              title="Remove filter"
            >
              <span>{c.label}</span>
              <X size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

