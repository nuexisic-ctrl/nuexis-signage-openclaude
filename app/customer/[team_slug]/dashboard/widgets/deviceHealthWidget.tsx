'use client'

import { HeartPulse, Wifi, WifiOff, Loader } from 'lucide-react'
import type { DeviceHealth } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  devices: DeviceHealth[]
}

export function DeviceHealthWidget({ devices }: Props) {
  const healthy = devices.filter(d => d.status === 'online' && d.uptimePercent >= 80).length
  const warning = devices.filter(d => d.status === 'online' && d.uptimePercent < 80).length
  const offline = devices.filter(d => d.status === 'offline').length

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <HeartPulse size={18} />
        <span className={styles.widgetTitle}>Device Health</span>
      </div>
      <div className={styles.healthSummary}>
        <div className={styles.healthStat}>
          <span className={styles.healthStatValue}>{healthy}</span>
          <span className={styles.healthStatLabel}>Healthy</span>
        </div>
        <div className={styles.healthStat}>
          <span className={`${styles.healthStatValue} ${styles.healthWarning}`}>{warning}</span>
          <span className={styles.healthStatLabel}>Warning</span>
        </div>
        <div className={styles.healthStat}>
          <span className={`${styles.healthStatValue} ${styles.healthCritical}`}>{offline}</span>
          <span className={styles.healthStatLabel}>Offline</span>
        </div>
      </div>
      <div className={styles.healthDeviceList}>
        {devices.slice(0, 4).map((d) => (
          <div key={d.deviceId} className={styles.healthDeviceItem}>
            <span className={styles.healthDeviceStatus}>
              {d.status === 'online' ? <Wifi size={14} className={styles.statusDotActive} /> :
               d.status === 'offline' ? <WifiOff size={14} className={styles.statusDotOffline} /> :
               <Loader size={14} className={styles.statusDotPairing} />}
            </span>
            <span className={styles.healthDeviceName}>{d.name || 'Unnamed'}</span>
            <span className={styles.healthDeviceUptime}>{d.uptimePercent}%</span>
          </div>
        ))}
      </div>
      {devices.length === 0 && (
        <div className={styles.healthEmpty}>
          <span>No devices to monitor</span>
        </div>
      )}
    </div>
  )
}
