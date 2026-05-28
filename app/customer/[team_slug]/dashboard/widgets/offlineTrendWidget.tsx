'use client'

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import type { OfflineTrend } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  data: OfflineTrend
}

export function OfflineTrendWidget({ data }: Props) {
  const { todayPercent, direction, changePercent } = data

  const trendIcon = direction === 'up'
    ? <TrendingUp size={18} className={styles.trendUp} />
    : direction === 'down'
      ? <TrendingDown size={18} className={styles.trendDown} />
      : <Minus size={18} className={styles.trendStable} />

  const trendLabel = direction === 'up' ? 'Increase' : direction === 'down' ? 'Decrease' : 'Stable'
  const isCritical = todayPercent > 50

  return (
    <div className={styles.overviewCard}>
      <div className={`${styles.overviewCardIcon} ${isCritical ? styles.overviewCardIconOffline : styles.overviewCardIconActive}`}>
        <AlertTriangle size={22} />
      </div>
      <div className={styles.overviewCardContent}>
        <div className={styles.overviewCardValueRow}>
          <span className={`${styles.overviewCardValue} ${isCritical ? styles.textDanger : ''}`}>
            {todayPercent}%
          </span>
          <span className={styles.trendBadge}>
            {trendIcon}
            <span className={styles.trendLabel}>{trendLabel}</span>
          </span>
        </div>
        <span className={styles.overviewCardLabel}>
          Screens Offline {direction === 'up' ? `(+${changePercent}%)` : direction === 'down' ? `(${changePercent}%)` : ''}
        </span>
      </div>
    </div>
  )
}
