'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Layers, HardDrive, Clock, CalendarDays, CalendarCheck, Monitor } from 'lucide-react'
import styles from '../workspace.module.css'
import type { PlaylistItemWithAsset, AssignedDevice } from '../actions'

interface PlaylistInfoPanelProps {
  items: PlaylistItemWithAsset[]
  createdAt: string
  updatedAt: string
  assignedDevices: AssignedDevice[]
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s > 0 ? `${s}s` : ''}`.trim()
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`.trim()
  return `${s}s`
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export default function PlaylistInfoPanel({ items, createdAt, updatedAt, assignedDevices }: PlaylistInfoPanelProps) {
  const { t } = useTranslation()

  const summary = useMemo(() => {
    let totalSizeBytes = 0
    let totalDuration = 0
    for (const item of items) {
      totalDuration += item.duration_seconds || 0
      if (item.assets?.size_bytes) {
        totalSizeBytes += item.assets.size_bytes
      }
    }
    return { totalItems: items.length, totalSizeBytes, totalDuration }
  }, [items])

  const screenCount = assignedDevices.length

  return (
    <div className={styles.infoPanel}>
      <h3 className={styles.infoPanelTitle}>{t('Details')}</h3>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <Layers size={14} /> {t('Total Items')}
        </span>
        <span className={styles.infoValue}>{summary.totalItems}</span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <HardDrive size={14} /> {t('Total Size')}
        </span>
        <span className={styles.infoValue}>{formatSize(summary.totalSizeBytes)}</span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <Clock size={14} /> {t('Total Duration')}
        </span>
        <span className={styles.infoValue}>{formatDuration(summary.totalDuration)}</span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <CalendarDays size={14} /> {t('Last Updated')}
        </span>
        <span className={styles.infoValue}>{formatRelativeTime(updatedAt)}</span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <CalendarCheck size={14} /> {t('Created')}
        </span>
        <span className={styles.infoValue}>
          {createdAt ? new Date(createdAt).toLocaleDateString() : '—'}
        </span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>
          <Monitor size={14} /> {t('Status')}
        </span>
        <span className={styles.infoValue}>
          {screenCount > 0 ? (
            <span className={`${styles.statusBadge} ${styles.statusAssigned}`}>
              {screenCount === 1
                ? t('Assigned to {count} screen', { count: screenCount })
                : t('Assigned to {count} screens', { count: screenCount })
              }
            </span>
          ) : (
            <span className={`${styles.statusBadge} ${styles.statusUnassigned}`}>
              {t('Unassigned')}
            </span>
          )}
        </span>
      </div>

      {screenCount > 0 && (
        <div className={styles.assignedScreensList}>
          {assignedDevices.slice(0, 5).map(device => (
            <div key={device.id} className={styles.assignedScreenItem}>
              <span className={`${styles.assignedScreenDot} ${
                device.status === 'online' ? styles.dotOnline : styles.dotOffline
              }`} />
              <span>{device.name || t('Unnamed Screen')}</span>
            </div>
          ))}
          {screenCount > 5 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)' }}>
              +{screenCount - 5} {t('more')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
