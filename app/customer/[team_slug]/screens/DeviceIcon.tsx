import React from 'react'
import styles from './DeviceIcon.module.css'
import { Device, Asset, Playlist, LiveStatus } from './types'

export function getContentLabel(device: Device, assets: Asset[] = [], playlists: Playlist[] = []) {
  if (device.content_type === 'Playlist') {
    if (!device.playlist_id) return 'No playlist selected';
    const pl = playlists.find(p => p.id === device.playlist_id);
    return pl ? `Playlist: ${pl.name}` : 'Unknown Playlist';
  }

  if (!device.asset_id) return 'No content';
  const asset = assets.find(a => a.id === device.asset_id);
  if (!asset) return 'Assigned Asset';
  if (asset.mime_type === 'application/x-widget-youtube') return 'YouTube (Widget)';
  if (asset.mime_type === 'application/x-widget-remote-url') return 'Remote URL (Widget)';
  if (asset.mime_type.startsWith('application/x-widget')) return `${asset.file_name} (Widget)`;
  return asset.file_name;
}

export function DeviceIcon({ name, orientation }: { name: string, orientation?: number | null }) {
  const nameLower = name.toLowerCase();
  const isMobile = nameLower.includes('mobile') || nameLower.includes('phone');
  const isTablet = nameLower.includes('tablet') || nameLower.includes('ipad');
  const isKiosk = nameLower.includes('kiosk') || orientation === 90 || orientation === 270;

  if (isMobile) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
    )
  }
  if (isTablet) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
    )
  }
  if (isKiosk) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="14" rx="1" ry="1"></rect>
        <line x1="12" y1="16" x2="12" y2="20"></line>
        <line x1="8" y1="20" x2="16" y2="20"></line>
      </svg>
    )
  }
  
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="12" rx="2" ry="2"></rect>
      <line x1="12" y1="16" x2="12" y2="20"></line>
      <line x1="8" y1="20" x2="16" y2="20"></line>
    </svg>
  )
}

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
