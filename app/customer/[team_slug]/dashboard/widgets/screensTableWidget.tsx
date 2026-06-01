'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Wifi, WifiOff, Loader, ArrowRight, SearchX } from 'lucide-react'
import styles from '../dashboard.module.css'
import type { DashboardDevice } from '../actions'

type Tab = 'all' | 'online' | 'offline' | 'pairing'

interface Props {
  teamSlug: string
  devices: DashboardDevice[]
}

export function ScreensTableWidget({ teamSlug, devices }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')

  const counts = useMemo(() => {
    const total = devices.length
    const online = devices.filter(d => d.status === 'online').length
    const offline = devices.filter(d => d.status === 'offline').length
    const pairing = devices.filter(d => d.status === 'pairing').length
    return { total, online, offline, pairing }
  }, [devices])

  const tabbed = useMemo(() => {
    if (tab === 'all') return devices
    return devices.filter(d => d.status === tab)
  }, [devices, tab])

  const rows = tabbed.slice(0, 10)

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <Monitor size={18} />
        <span className={styles.widgetTitle}>Screens</span>
        <div className={styles.screensTabs}>
          <button className={tab === 'all' ? styles.screensTabActive : styles.screensTab} onClick={() => setTab('all')}>
            All <span className={styles.screensTabCount}>{counts.total}</span>
          </button>
          <button className={tab === 'online' ? styles.screensTabActive : styles.screensTab} onClick={() => setTab('online')}>
            Online <span className={styles.screensTabCount}>{counts.online}</span>
          </button>
          <button className={tab === 'offline' ? styles.screensTabActive : styles.screensTab} onClick={() => setTab('offline')}>
            Offline <span className={styles.screensTabCount}>{counts.offline}</span>
          </button>
          <button className={tab === 'pairing' ? styles.screensTabActive : styles.screensTab} onClick={() => setTab('pairing')}>
            Pairing <span className={styles.screensTabCount}>{counts.pairing}</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.screensEmpty}>
          <SearchX size={30} />
          <div>
            <div className={styles.screensEmptyTitle}>No matching screens</div>
            <div className={styles.screensEmptyHint}>Try adjusting filters above.</div>
          </div>
        </div>
      ) : (
        <div className={styles.screensTableWrap}>
          <table className={styles.screensTable}>
            <thead>
              <tr>
                <th>Screen</th>
                <th>Status</th>
                <th>Last seen</th>
                <th>Content</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className={styles.screensRow}
                  onClick={() => router.push(`/customer/${teamSlug}/screens`)}
                  title="View screen details"
                >
                  <td className={styles.screensCellName}>
                    <span className={styles.screensNameIcon}>
                      <Monitor size={14} />
                    </span>
                    <span className={styles.screensNameText}>{d.name || 'Unnamed Screen'}</span>
                  </td>
                  <td>
                    <StatusPill status={d.status} offlineMinutes={d.offlineMinutes} />
                  </td>
                  <td className={styles.screensCellMuted}>
                    {d.lastSeenAt ? timeAgo(new Date(d.lastSeenAt)) : '—'}
                  </td>
                  <td className={styles.screensCellContent}>
                    <span className={styles.screensContentType}>{d.contentType || 'Unassigned'}</span>
                    <span className={styles.screensContentName}>{d.contentName || '—'}</span>
                  </td>
                  <td className={styles.screensCellUptime}>
                    <span className={styles.screensUptimeValue}>{d.uptimePercent}%</span>
                    <span className={styles.screensUptimeBar}>
                      <span className={styles.screensUptimeFill} style={{ width: `${Math.max(0, Math.min(100, d.uptimePercent))}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.screensFooter}>
        <button className={styles.screensFooterBtn} onClick={() => router.push(`/customer/${teamSlug}/screens`)}>
          View all screens <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function StatusPill({ status, offlineMinutes }: { status: DashboardDevice['status']; offlineMinutes: number | null }) {
  if (status === 'online') {
    return (
      <span className={`${styles.statusPill} ${styles.statusPillOnline}`}>
        <Wifi size={14} /> Online
      </span>
    )
  }
  if (status === 'pairing') {
    return (
      <span className={`${styles.statusPill} ${styles.statusPillPairing}`}>
        <Loader size={14} /> Pairing
      </span>
    )
  }
  return (
    <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>
      <WifiOff size={14} /> Offline{offlineMinutes != null ? ` · ${formatMinutes(offlineMinutes)}` : ''}
    </span>
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

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const rem = mins % 60
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH ? `${d}d ${remH}h` : `${d}d`
}

