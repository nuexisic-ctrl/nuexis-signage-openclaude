'use client'

import { History, Wifi, WifiOff, Link } from 'lucide-react'
import type { Activity } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  activities: Activity[]
}

const eventIcon: Record<string, React.FC<{ size?: number }>> = {
  device_online: Wifi,
  device_offline: WifiOff,
  device_paired: Link,
}

export function RecentActivityWidget({ activities }: Props) {
  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <History size={18} />
        <span className={styles.widgetTitle}>Recent Activity</span>
      </div>
      <div className={styles.activityList}>
        {activities.length === 0 ? (
          <div className={styles.activityEmpty}>
            <span>No recent activity</span>
          </div>
        ) : (
          activities.map((a) => {
            const Icon = eventIcon[a.eventType] || History
            return (
              <div key={a.id} className={styles.activityItem}>
                <span className={styles.activityIcon}>
                  <Icon size={14} />
                </span>
                <div className={styles.activityContent}>
                  <span className={styles.activityDesc}>{a.description}</span>
                  <span className={styles.activityTime}>{timeAgo(new Date(a.createdAt))}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
