'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import styles from '../dashboard.module.css'

export function DateTimeStatusWidget() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return (
    <div className={styles.dateTimeWidget}>
      <div className={styles.dateTimeMain}>
        <Clock size={16} />
        <div>
          <span className={styles.dateTimeTime} suppressHydrationWarning>{formattedTime}</span>
          <span className={styles.dateTimeDate} suppressHydrationWarning>{formattedDate}</span>
        </div>
      </div>
      <div className={styles.backendStatus}>
        <span className={styles.backendDot} />
        <span className={styles.backendLabel}>Backend Operational</span>
      </div>
    </div>
  )
}
