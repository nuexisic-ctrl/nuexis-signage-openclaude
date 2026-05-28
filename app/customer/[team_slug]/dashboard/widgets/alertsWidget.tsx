'use client'

import { Bell, AlertTriangle, Info, XCircle } from 'lucide-react'
import type { Alert } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  alerts: Alert[]
}

const severityIcon = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const severityClass = {
  critical: styles.alertCritical,
  warning: styles.alertWarning,
  info: styles.alertInfo,
}

export function AlertsWidget({ alerts }: Props) {
  const displayAlerts = alerts.slice(0, 6)

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <Bell size={18} />
        <span className={styles.widgetTitle}>Alerts & Issues</span>
        {alerts.length > 0 && <span className={styles.alertCount}>{alerts.length}</span>}
      </div>
      <div className={styles.alertsList}>
        {displayAlerts.length === 0 ? (
          <div className={styles.alertsEmpty}>
            <CheckCircleIcon />
            <span>No active alerts</span>
          </div>
        ) : (
          displayAlerts.map((a) => {
            const SevIcon = severityIcon[a.severity]
            return (
              <div key={a.id} className={`${styles.alertItem} ${severityClass[a.severity]}`}>
                <SevIcon size={16} />
                <div className={styles.alertItemContent}>
                  <span className={styles.alertItemMessage}>{a.message}</span>
                  <span className={styles.alertItemTime}>
                    {timeAgo(new Date(a.timestamp))}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
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
