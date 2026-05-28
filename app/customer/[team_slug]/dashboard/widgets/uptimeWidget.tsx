'use client'

import { Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { UptimeDataPoint } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  uptimePercent: number
  history: UptimeDataPoint[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatter = (value: any) => [`${value}%`, 'Uptime']

export function UptimeWidget({ uptimePercent, history }: Props) {
  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <Activity size={18} />
        <span className={styles.widgetTitle}>App Uptime</span>
        <span className={styles.uptimeBadge}>{uptimePercent}%</span>
      </div>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-lowest)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={tooltipFormatter}
            />
            <Area type="monotone" dataKey="uptime" stroke="var(--primary)" fill="url(#uptimeGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
