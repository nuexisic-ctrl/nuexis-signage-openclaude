'use client'

import { Calendar, Monitor, Film, Play } from 'lucide-react'
import type { ScheduleEvent } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  events: ScheduleEvent[]
}

const contentTypeIcon: Record<string, React.FC<{ size?: number }>> = {
  Asset: Film,
  Playlist: Play,
  Schedule: Calendar,
}

export function ScheduledTimelineWidget({ events }: Props) {
  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <Calendar size={18} />
        <span className={styles.widgetTitle}>Scheduled Timeline</span>
      </div>
      <div className={styles.timelineList}>
        {events.length === 0 ? (
          <div className={styles.timelineEmpty}>
            <Calendar size={32} />
            <span>No content scheduled yet</span>
            <span className={styles.timelineEmptyHint}>Assign a playlist or asset to a screen</span>
          </div>
        ) : (
          events.map((e) => {
            const Icon = contentTypeIcon[e.contentType || ''] || Monitor
            return (
              <div key={e.id} className={styles.timelineItem}>
                <div className={styles.timelineDot} />
                <div className={styles.timelineConnector} />
                <span className={styles.timelineIcon}>
                  <Icon size={16} />
                </span>
                <div className={styles.timelineContent}>
                  <span className={styles.timelineDeviceName}>{e.deviceName || 'Unnamed Screen'}</span>
                  <span className={styles.timelineContentName}>{e.contentName || 'No content'}</span>
                </div>
                <span className={styles.timelineTag}>{e.contentType || 'N/A'}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
