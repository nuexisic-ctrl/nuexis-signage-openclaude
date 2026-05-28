'use client'

import { useRouter } from 'next/navigation'
import { Plus, Upload, List, Monitor } from 'lucide-react'
import styles from '../dashboard.module.css'

interface Props {
  teamSlug: string
}

export function QuickActionsWidget({ teamSlug }: Props) {
  const router = useRouter()

  const actions = [
    { icon: Monitor, label: 'Add Screen', href: `/${teamSlug}/screens`, color: '#2563eb' },
    { icon: Upload, label: 'Upload Asset', href: `/${teamSlug}/asset`, color: '#7c3aed' },
    { icon: List, label: 'Create Playlist', href: `/${teamSlug}/playlists`, color: '#059669' },
    { icon: Plus, label: 'View All', href: `/${teamSlug}/screens`, color: '#d97706' },
  ]

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetTitle}>Quick Actions</span>
      </div>
      <div className={styles.quickActionsGrid}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={styles.quickActionBtn}
            onClick={() => router.push(`/customer${a.href}`)}
          >
            <span className={styles.quickActionIcon} style={{ background: `${a.color}1a`, color: a.color }}>
              <a.icon size={18} />
            </span>
            <span className={styles.quickActionLabel}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
