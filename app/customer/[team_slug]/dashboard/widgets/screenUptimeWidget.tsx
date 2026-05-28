'use client'

import { TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ScreenUptime } from '../actions'
import styles from '../dashboard.module.css'

interface Props {
  data: ScreenUptime[]
}

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']

export function ScreenUptimeWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className={styles.widgetBody}>
        <div className={styles.widgetHeader}>
          <TrendingUp size={18} />
          <span className={styles.widgetTitle}>Screen Uptime</span>
        </div>
        <div className={styles.chartEmpty}>
          <TrendingUp size={32} />
          <span>No screen data available</span>
        </div>
      </div>
    )
  }

  const chartData = data[0]?.history.map((_, i) => {
    const point: Record<string, string | number> = { date: data[0].history[i].date }
    data.forEach((s) => {
      if (s.history[i]) {
        point[s.name || s.deviceId] = s.history[i].uptime
      }
    })
    return point
  }) || []

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <TrendingUp size={18} />
        <span className={styles.widgetTitle}>Screen Uptime</span>
      </div>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-lowest)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--on-surface-subtle)' }}
            />
            {data.map((s, i) => (
              <Line
                key={s.deviceId}
                type="monotone"
                dataKey={s.name || s.deviceId}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
