import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './DeviceIcon.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'

// ── Content type classification ───────────────────────────────────────────────
export type ContentKind =
  | 'playlist'
  | 'image'
  | 'video'
  | 'clock'
  | 'youtube'
  | 'remote-url'
  | 'html-widget'
  | 'empty'

export function getActivePlaylistItem(
  playlist: Playlist | undefined,
  nowMs: number = Date.now()
) {
  if (!playlist || !playlist.playlist_items || playlist.playlist_items.length === 0) {
    return { item: null, index: -1, elapsedInItem: 0, remainingInItem: 0, totalCycleSeconds: 0, elapsedInCycle: 0 }
  }
  const items = playlist.playlist_items
  const totalCycleSeconds = items.reduce((acc, item) => acc + (item.duration_seconds || 10), 0)
  if (totalCycleSeconds <= 0) {
    return { item: items[0], index: 0, elapsedInItem: 0, remainingInItem: items[0].duration_seconds || 10, totalCycleSeconds: 0, elapsedInCycle: 0 }
  }

  // Elapsed seconds in the current cycle
  const elapsedInCycle = (nowMs / 1000) % totalCycleSeconds

  let currentStart = 0
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const duration = item.duration_seconds || 10
    const currentEnd = currentStart + duration
    if (elapsedInCycle >= currentStart && elapsedInCycle < currentEnd) {
      const elapsedInItem = elapsedInCycle - currentStart
      const remainingInItem = duration - elapsedInItem
      return {
        item,
        index: i,
        elapsedInItem,
        remainingInItem,
        totalCycleSeconds,
        elapsedInCycle
      }
    }
    currentStart = currentEnd
  }

  const lastItem = items[items.length - 1]
  const lastDuration = lastItem.duration_seconds || 10
  return {
    item: lastItem,
    index: items.length - 1,
    elapsedInItem: lastDuration,
    remainingInItem: 0,
    totalCycleSeconds,
    elapsedInCycle: totalCycleSeconds
  }
}

export function getContentKind(
  device: Device,
  assets: Asset[] = [],
  playlists: Playlist[] = [],
  nowMs: number = Date.now()
): ContentKind {
  if (device.content_type === 'Playlist' && device.playlist_id) {
    const pl = playlists.find(p => p.id === device.playlist_id)
    const { item } = getActivePlaylistItem(pl, nowMs)
    if (!item) return 'playlist'
    
    if (item.widget_type === 'flow-clock' || item.assets?.mime_type === 'application/x-widget-flow') return 'clock'
    if (item.assets) {
      const mime = item.assets.mime_type
      if (mime === 'application/x-widget-youtube') return 'youtube'
      if (mime === 'application/x-widget-remote-url') return 'remote-url'
      if (mime === 'application/x-widget-html') return 'html-widget'
      if (mime === 'application/x-widget-flow') return 'clock'
      if (mime.startsWith('video/')) return 'video'
      if (mime.startsWith('image/')) return 'image'
    }
    return 'playlist'
  }
  if (!device.asset_id) return 'empty'
  const asset = assets.find(a => a.id === device.asset_id)
  if (!asset) return 'empty'
  if (asset.mime_type === 'application/x-widget-youtube') return 'youtube'
  if (asset.mime_type === 'application/x-widget-remote-url') return 'remote-url'
  if (asset.mime_type === 'application/x-widget-html') return 'html-widget'
  if (asset.mime_type === 'application/x-widget-flow') return 'clock'
  if (asset.mime_type.startsWith('video/')) return 'video'
  if (asset.mime_type.startsWith('image/')) return 'image'
  return 'empty'
}

// ── Clock style → display name map ───────────────────────────────────────────
const CLOCK_STYLE_NAMES: Record<string, string> = {
  'classic-digital': 'Classic Digital',
  'modern-digital':  'Modern Digital',
  'classic-analog':  'Classic Analog',
  'modern-analog':   'Modern Analog',
  'minimalist':      'Minimalist',
}

export function getClockStyleName(filePathOrConfig: string): string {
  try {
    const cfg = JSON.parse(filePathOrConfig)
    return CLOCK_STYLE_NAMES[cfg.style] ?? cfg.style ?? 'Clock'
  } catch {
    return 'Clock'
  }
}

// ── Human-readable label (column text) ────────────────────────────────────────
export function getContentLabel(device: Device, assets: Asset[] = [], playlists: Playlist[] = []) {
  if (device.content_type === 'Playlist') {
    if (!device.playlist_id) return 'No Content Loop selected'
    const pl = playlists.find(p => p.id === device.playlist_id)
    return pl ? pl.name : 'Unknown Content Loop'
  }
  if (!device.asset_id) return 'No content assigned'
  const asset = assets.find(a => a.id === device.asset_id)
  if (!asset) return 'Assigned Asset'
  if (asset.mime_type === 'application/x-widget-youtube') return 'YouTube'
  if (asset.mime_type === 'application/x-widget-remote-url') return 'Remote URL'
  if (asset.mime_type === 'application/x-widget-html') return 'Custom HTML'
  if (asset.mime_type === 'application/x-widget-flow') {
    return `${asset.file_name} (${getClockStyleName(asset.file_path)})`
  }
  return asset.file_name
}

// ── Tooltip info builder ───────────────────────────────────────────────────────
export interface ContentTooltipInfo {
  headline: string
  meta: { label: string; value: string }[]
  note?: string
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s'
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (s && !h) parts.push(`${s}s`)
  return parts.join(' ')
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function describePrimaryPlaylistContent(items: Playlist['playlist_items']): string {
  if (!items || items.length === 0) return 'No items'
  const kinds: Record<string, number> = {}
  for (const item of items) {
    let kind = 'Other'
    if (item.widget_type === 'flow-clock' || item.assets?.mime_type === 'application/x-widget-flow') kind = 'Clock'
    else if (item.assets?.mime_type?.startsWith('video/')) kind = 'Video'
    else if (item.assets?.mime_type?.startsWith('image/')) kind = 'Image'
    else if (item.assets?.mime_type === 'application/x-widget-youtube') kind = 'YouTube'
    else if (item.assets?.mime_type === 'application/x-widget-remote-url') kind = 'Remote URL'
    else if (item.assets?.mime_type === 'application/x-widget-html') kind = 'Custom HTML'
    kinds[kind] = (kinds[kind] || 0) + 1
  }
  const sorted = Object.entries(kinds).sort((a, b) => b[1] - a[1])
  if (sorted.length === 1) return sorted[0][0]
  return sorted.slice(0, 2).map(([k]) => k).join(' & ')
}

export function buildTooltipInfo(
  device: Device,
  assets: Asset[],
  playlists: Playlist[]
): ContentTooltipInfo {
  if (device.content_type === 'Playlist') {
    const pl = playlists.find(p => p.id === device.playlist_id)
    const items = pl?.playlist_items ?? []
    const totalSec = items.reduce((acc, it) => acc + (it.duration_seconds || 10), 0)
    const itemCount = items.length

    return {
      headline: 'Playing Content Loop',
      meta: [
        { label: 'Name', value: pl?.name ?? 'Unknown Content Loop' },
        { label: 'Loop Stats', value: `${itemCount} item${itemCount !== 1 ? 's' : ''} / ${formatDuration(totalSec)}` },
        { label: 'Content Type', value: describePrimaryPlaylistContent(items) },
      ],
      note: 'This content loop plays continuously on the player device.',
    }
  }

  const asset = assets.find(a => a.id === device.asset_id)
  const kind = getContentKind(device, assets, playlists)

  // ── Empty ──
  if (kind === 'empty' || !asset) {
    return {
      headline: 'No Content Assigned',
      meta: [],
      note: 'Click here or Edit to assign content to this screen.',
    }
  }

  // ── Image ──
  if (kind === 'image') {
    return {
      headline: 'Displaying an Image',
      meta: [
        { label: 'File Name', value: asset.file_name },
        { label: 'MIME Type', value: asset.mime_type },
        { label: 'Size', value: formatBytes(asset.size_bytes) },
      ],
    }
  }

  // ── Video ──
  if (kind === 'video') {
    return {
      headline: 'Playing a Video',
      meta: [
        { label: 'File Name', value: asset.file_name },
        { label: 'MIME Type', value: asset.mime_type },
        { label: 'Size', value: formatBytes(asset.size_bytes) },
      ],
      note: 'This video loops automatically on the player device.',
    }
  }

  // ── Clock Widget ──
  if (kind === 'clock') {
    const clockStyle = getClockStyleName(asset.file_path || '{}')
    return {
      headline: 'Showing a Clock',
      meta: [
        { label: 'Clock Style', value: clockStyle },
      ],
      note: 'This clock updates every second on the player device.',
    }
  }

  // ── YouTube ──
  if (kind === 'youtube') {
    return {
      headline: 'Streaming YouTube',
      meta: [
        { label: 'URL', value: asset.file_name },
        { label: 'Embed Type', value: 'YouTube Embed' },
      ],
    }
  }

  // ── Remote URL ──
  if (kind === 'remote-url') {
    return {
      headline: 'Loading Remote URL',
      meta: [
        { label: 'URL', value: asset.file_name },
        { label: 'Embed Type', value: 'Web Page Embed' },
      ],
    }
  }

  // ── Custom HTML ──
  if (kind === 'html-widget') {
    return {
      headline: 'Running Custom HTML',
      meta: [
        { label: 'Widget Name', value: asset.file_name },
      ],
      note: 'This custom HTML widget renders interactively on the player device.',
    }
  }

  return {
    headline: 'Content Assigned',
    meta: [{ label: 'Name', value: asset.file_name }],
  }
}

// ── Smart content icon ────────────────────────────────────────────────────────
export function ContentIcon({ kind, size = 18 }: { kind: ContentKind; size?: number }) {
  const s = { width: size, height: size }
  const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (kind === 'clock') return (
    <svg {...s} {...base}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
  if (kind === 'image') return (
    <svg {...s} {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
  if (kind === 'video') return (
    <svg {...s} {...base}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
  if (kind === 'youtube') return (
    <svg {...s} {...base}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  )
  if (kind === 'remote-url') return (
    <svg {...s} {...base}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
  if (kind === 'html-widget') return (
    <svg {...s} {...base}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
  if (kind === 'playlist') return (
    <svg {...s} {...base}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
  // empty
  return (
    <svg {...s} {...base}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.36-1.36" />
    </svg>
  )
}

// ── Tooltip portal component ──────────────────────────────────────────────────
interface ContentTooltipProps {
  info: ContentTooltipInfo
  children: React.ReactNode
}

export function ContentTooltipWrapper({ info, children }: ContentTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const show = () => {
    if (!triggerRef.current) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      })
      setVisible(true)
    }, 250) // Ideal amount of hover delay (250ms)
  }

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Reposition if tooltip overflows right edge
  useEffect(() => {
    if (!visible || !tooltipRef.current) return
    const rect = tooltipRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth - 12) {
      setPos(p => ({ ...p, left: Math.max(12, window.innerWidth - rect.width - 12) }))
    }
  }, [visible])

  return (
    <div
      ref={triggerRef}
      className={styles.tooltipTrigger}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {mounted && visible && createPortal(
        <div
          ref={tooltipRef}
          className={styles.contentTooltip}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className={styles.tooltipHeadline}>{info.headline}</div>
          {info.meta.length > 0 && (
            <ul className={styles.tooltipMeta}>
              {info.meta.map((row, i) => (
                <li key={i} className={styles.tooltipMetaRow}>
                  <span className={styles.tooltipMetaLabel}>{row.label}</span>
                  <span className={styles.tooltipMetaValue}>{row.value}</span>
                </li>
              ))}
            </ul>
          )}
          {info.note && <p className={styles.tooltipNote}>{info.note}</p>}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Device icon ───────────────────────────────────────────────────────────────
export function DeviceIcon({ name, orientation }: { name: string, orientation?: number | null }) {
  const nameLower = name.toLowerCase()
  const isMobile = nameLower.includes('mobile') || nameLower.includes('phone')
  const isTablet = nameLower.includes('tablet') || nameLower.includes('ipad')
  const isKiosk = nameLower.includes('kiosk') || orientation === 90 || orientation === 270

  if (isMobile) return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
  if (isTablet) return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
  if (isKiosk) return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="14" rx="1" ry="1" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  )
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="12" rx="2" ry="2" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: LiveStatus }) {
  const cls: Record<LiveStatus, string> = {
    online:  styles.statusOnline,
    offline: styles.statusOffline,
    pairing: styles.statusPairing,
  }
  const dotCls: Record<LiveStatus, string> = {
    online:  styles.statusDotOnline,
    offline: styles.statusDotOffline,
    pairing: styles.statusDotPairing,
  }
  return (
    <span className={`${styles.statusBadge} ${cls[status]}`}>
      <span className={`${styles.statusDot} ${dotCls[status]}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Last-seen formatter ───────────────────────────────────────────────────────
export function formatLastSeen(dateStr: string | null | undefined, isOnline: boolean, nowMs = Date.now()): string {
  if (isOnline) return 'Active now'
  if (!dateStr) return 'Never'
  const diff = nowMs - new Date(dateStr).getTime()
  const prefix = 'Seen'
  if (diff < 60000) return `${prefix} just now`
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${prefix} ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${prefix} ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${prefix} ${days}d ago`
}

export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds === 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim()
  return `${m}m`
}
