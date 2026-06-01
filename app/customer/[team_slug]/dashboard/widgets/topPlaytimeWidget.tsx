'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Timer } from 'lucide-react'
import styles from '../dashboard.module.css'
import type { DashboardDevice } from '../actions'

interface Props {
  devices: DashboardDevice[]
}

export function TopPlaytimeWidget({ devices }: Props) {
  const data = [...devices]
    .sort((a, b) => (b.totalPlaytimeSeconds || 0) - (a.totalPlaytimeSeconds || 0))
    .slice(0, 8)
    .map((d) => ({
      name: (d.name || 'Unnamed').slice(0, 14),
      seconds: d.totalPlaytimeSeconds || 0,
      hours: Math.round((d.totalPlaytimeSeconds || 0) / 360) / 10, // one decimal hour
    }))

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <Timer size={18} />
        <span className={styles.widgetTitle}>Top Screens (Playtime)</span>
      </div>

      {data.length === 0 ? (
        <div className={styles.chartEmpty}>
          <Timer size={32} />
          <span>No playtime data yet</span>
        </div>
      ) : (
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-subtle)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-lowest)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: unknown) => {
                  const n = typeof v === 'number' ? v : Number(v)
                  return [`${n.toFixed(1)}h`, 'Playtime']
                }}
              />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

