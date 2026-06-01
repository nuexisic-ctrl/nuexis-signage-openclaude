'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import styles from '../dashboard.module.css'
import type { DashboardDevice } from '../actions'

interface Props {
  devices: DashboardDevice[]
}

const COLORS: Record<string, string> = {
  online: '#22c55e',
  pairing: '#f59e0b',
  offline: '#ef4444',
}

export function StatusBreakdownWidget({ devices }: Props) {
  const online = devices.filter(d => d.status === 'online').length
  const pairing = devices.filter(d => d.status === 'pairing').length
  const offline = devices.filter(d => d.status === 'offline').length
  const total = devices.length

  const data = [
    { name: 'Online', key: 'online', value: online },
    { name: 'Pairing', key: 'pairing', value: pairing },
    { name: 'Offline', key: 'offline', value: offline },
  ].filter(d => d.value > 0)

  return (
    <div className={styles.widgetBody}>
      <div className={styles.widgetHeader}>
        <PieIcon size={18} />
        <span className={styles.widgetTitle}>Status Breakdown</span>
        <span className={styles.statusBreakdownTotal}>{total}</span>
      </div>

      {total === 0 ? (
        <div className={styles.chartEmpty}>
          <PieIcon size={32} />
          <span>No screen data available</span>
        </div>
      ) : (
        <div className={styles.statusBreakdownWrap}>
          <div className={styles.statusBreakdownChart}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-lowest)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={COLORS[entry.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.statusLegend}>
            <LegendItem color={COLORS.online} label="Online" value={online} />
            <LegendItem color={COLORS.pairing} label="Pairing" value={pairing} />
            <LegendItem color={COLORS.offline} label="Offline" value={offline} />
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className={styles.statusLegendItem}>
      <span className={styles.statusLegendDot} style={{ background: color }} />
      <span className={styles.statusLegendLabel}>{label}</span>
      <span className={styles.statusLegendValue}>{value}</span>
    </div>
  )
}

