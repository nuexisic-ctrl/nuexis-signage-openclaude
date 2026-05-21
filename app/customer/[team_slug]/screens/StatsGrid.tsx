'use client'

import styles from './StatsGrid.module.css'
import { formatPlaytime } from './DeviceIcon'

interface StatsGridProps {
  totalScreens: number
  onlineCount: number
  offlineCount: number
  totalPlaytimeSeconds: number
}

export function StatsGrid({
  totalScreens,
  onlineCount,
  offlineCount,
  totalPlaytimeSeconds,
}: StatsGridProps) {
  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <div className={`${styles.statIconWrapper} ${styles.statIconTotal}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statValue}>{totalScreens}</span>
          <span className={styles.statLabel}>Total Screens</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={`${styles.statIconWrapper} ${styles.statIconOnline}`}>
          <span className={styles.statusDotOnlineLarge} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statValue}>{onlineCount}</span>
          <span className={styles.statLabel}>Online</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={`${styles.statIconWrapper} ${styles.statIconOffline}`}>
          <span className={styles.statusDotOfflineLarge} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statValue}>{offlineCount}</span>
          <span className={styles.statLabel}>Offline</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={`${styles.statIconWrapper} ${styles.statIconPlaytime}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statValue}>{formatPlaytime(totalPlaytimeSeconds)}</span>
          <span className={styles.statLabel}>Total Playtime</span>
        </div>
      </div>
    </div>
  )
}
