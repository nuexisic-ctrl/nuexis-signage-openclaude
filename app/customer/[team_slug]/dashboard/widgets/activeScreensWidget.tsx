'use client'

import { Monitor, Wifi, WifiOff, Loader } from 'lucide-react'
import styles from '../dashboard.module.css'

interface Props {
  totalScreens: number
  activeScreens: number
  offlineScreens: number
  pairingScreens: number
}

export function ActiveScreensWidget({ totalScreens, activeScreens, offlineScreens, pairingScreens }: Props) {
  return (
    <div className={styles.fixedOverviewGrid}>
      <div className={styles.overviewCard}>
        <div className={styles.overviewCardIcon}>
          <Monitor size={22} />
        </div>
        <div className={styles.overviewCardContent}>
          <span className={styles.overviewCardValue}>{totalScreens}</span>
          <span className={styles.overviewCardLabel}>Total Screens</span>
        </div>
      </div>

      <div className={styles.overviewCard}>
        <div className={`${styles.overviewCardIcon} ${styles.overviewCardIconActive}`}>
          <Wifi size={22} />
        </div>
        <div className={styles.overviewCardContent}>
          <div className={styles.overviewCardValueRow}>
            <span className={styles.overviewCardValue}>{activeScreens}</span>
            <span className={styles.statusDotActive} />
          </div>
          <span className={styles.overviewCardLabel}>Active Screens</span>
        </div>
      </div>

      <div className={styles.overviewCard}>
        <div className={`${styles.overviewCardIcon} ${styles.overviewCardIconOffline}`}>
          <WifiOff size={22} />
        </div>
        <div className={styles.overviewCardContent}>
          <div className={styles.overviewCardValueRow}>
            <span className={styles.overviewCardValue}>{offlineScreens}</span>
            <span className={styles.statusDotOffline} />
          </div>
          <span className={styles.overviewCardLabel}>Offline Screens</span>
        </div>
      </div>

      {pairingScreens > 0 && (
        <div className={styles.overviewCard}>
          <div className={`${styles.overviewCardIcon} ${styles.overviewCardIconPairing}`}>
            <Loader size={22} />
          </div>
          <div className={styles.overviewCardContent}>
            <span className={styles.overviewCardValue}>{pairingScreens}</span>
            <span className={styles.overviewCardLabel}>Pairing</span>
          </div>
        </div>
      )}
    </div>
  )
}
