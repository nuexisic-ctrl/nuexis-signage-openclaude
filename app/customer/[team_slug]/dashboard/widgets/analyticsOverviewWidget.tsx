'use client'

import { BarChart3, Clock, Eye, Star, TrendingUp } from 'lucide-react'
import type { AnalyticsOverview } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  data: AnalyticsOverview
}

export function AnalyticsOverviewWidget({ data }: Props) {
  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <BarChart3 size={18} />
        <span className={styles.widgetTitle}>Analytics Overview</span>
      </div>
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticsCard}>
          <span className={styles.analyticsIcon}><Clock size={18} /></span>
          <div>
            <span className={styles.analyticsValue}>{data.formattedPlaytime}</span>
            <span className={styles.analyticsLabel}>Proof of Play</span>
          </div>
        </div>

        <div className={`${styles.analyticsCard} ${styles.analyticsComingSoon}`}>
          <span className={styles.analyticsIcon}><Eye size={18} /></span>
          <div>
            <span className={styles.analyticsValue}>--</span>
            <span className={styles.analyticsLabel}>Impressions <span className={styles.comingSoonTag}>Soon</span></span>
          </div>
        </div>

        <div className={`${styles.analyticsCard} ${styles.analyticsComingSoon}`}>
          <span className={styles.analyticsIcon}><Star size={18} /></span>
          <div>
            <span className={styles.analyticsValue}>--</span>
            <span className={styles.analyticsLabel}>Top Content <span className={styles.comingSoonTag}>Soon</span></span>
          </div>
        </div>

        <div className={`${styles.analyticsCard} ${styles.analyticsComingSoon}`}>
          <span className={styles.analyticsIcon}><TrendingUp size={18} /></span>
          <div>
            <span className={styles.analyticsValue}>--</span>
            <span className={styles.analyticsLabel}>Top Skills <span className={styles.comingSoonTag}>Soon</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
