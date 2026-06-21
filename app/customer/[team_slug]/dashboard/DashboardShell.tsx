'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

import { ActiveScreensWidget } from './widgets/activeScreensWidget'
import { OfflineTrendWidget } from './widgets/offlineTrendWidget'
import { UptimeWidget } from './widgets/uptimeWidget'
import { QuickActionsWidget } from './widgets/quickActionsWidget'
import { AlertsWidget } from './widgets/alertsWidget'
import { RecentActivityWidget } from './widgets/recentActivityWidget'
import { AnalyticsOverviewWidget } from './widgets/analyticsOverviewWidget'
import { DeviceHealthWidget } from './widgets/deviceHealthWidget'
import { ScreenUptimeWidget } from './widgets/screenUptimeWidget'
import { DateTimeStatusWidget } from './widgets/dateTimeStatusWidget'
import { ScreensTableWidget } from './widgets/screensTableWidget'
import { StatusBreakdownWidget } from './widgets/statusBreakdownWidget'
import { TopPlaytimeWidget } from './widgets/topPlaytimeWidget'
import DashboardFiltersBar, { type DashboardFilters } from './DashboardFiltersBar'

import type {
  DashboardStats,
  OfflineTrend,
  Alert,
  Activity,
  AnalyticsOverview,
  DeviceHealth,
  UptimeDataPoint,
  ScreenUptime,
  DashboardDevice,
  PlaylistOption,
  AssetOption,
} from './actions'

import styles from './dashboard.module.css'

interface WidgetDef {
  id: string
  title: string
  // Presentation hints for the fixed (non-draggable) layout.
  span: { lg: number; md: number; sm: number }
  minHeightPx: number
}

const WIDGET_REGISTRY = new Map<string, WidgetDef>([
  ['dateTimeStatus', { id: 'dateTimeStatus', title: 'Date & Status', span: { lg: 3, md: 3, sm: 1 }, minHeightPx: 120 }],
  ['quickActions', { id: 'quickActions', title: 'Quick Actions', span: { lg: 3, md: 3, sm: 1 }, minHeightPx: 220 }],
  ['uptime', { id: 'uptime', title: 'App Uptime', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 260 }],
  ['screensTable', { id: 'screensTable', title: 'Screens', span: { lg: 12, md: 6, sm: 1 }, minHeightPx: 380 }],
  ['alerts', { id: 'alerts', title: 'Alerts & Issues', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 260 }],
  ['recentActivity', { id: 'recentActivity', title: 'Recent Activity', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 300 }],
  ['statusBreakdown', { id: 'statusBreakdown', title: 'Status Breakdown', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 320 }],
  ['topPlaytime', { id: 'topPlaytime', title: 'Top Screens', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 320 }],
  ['deviceHealth', { id: 'deviceHealth', title: 'Device Health', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 260 }],
  ['analyticsOverview', { id: 'analyticsOverview', title: 'Analytics Overview', span: { lg: 6, md: 6, sm: 1 }, minHeightPx: 240 }],
  ['screenUptime', { id: 'screenUptime', title: 'Screen Uptime', span: { lg: 12, md: 6, sm: 1 }, minHeightPx: 360 }]
])

const ALL_WIDGET_IDS = Array.from(WIDGET_REGISTRY.keys())

// Fixed, curated order for a stable, professional dashboard layout.
const DEFAULT_WIDGET_ORDER: string[] = [
  'dateTimeStatus',
  'quickActions',
  'uptime',
  'screensTable',
  'alerts',
  'recentActivity',
  'statusBreakdown',
  'topPlaytime',
  'deviceHealth',
  'analyticsOverview',
  'screenUptime',
]

interface DashboardData {
  stats: DashboardStats | null
  offlineTrend: OfflineTrend
  alerts: Alert[]
  activities: Activity[]
  analytics: AnalyticsOverview
  deviceHealth: DeviceHealth[]
  uptimeHistory: UptimeDataPoint[]
  screenUptimeData: ScreenUptime[]
}

interface Props extends DashboardData {
  teamSlug: string
  teamId: string
  devices: DashboardDevice[]
  playlistOptions: PlaylistOption[]
  assetOptions: AssetOption[]
}

export default function DashboardShell({
  teamSlug,
  stats,
  offlineTrend,
  alerts,
  activities,
  analytics,
  deviceHealth,
  uptimeHistory,
  screenUptimeData,
  devices,
  playlistOptions,
  assetOptions,
}: Props) {
  const { t } = useTranslation()
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem(`dashboard_hidden_${teamSlug}`)
      if (!saved) return new Set()
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return new Set()
      return new Set(parsed.filter((v) => typeof v === 'string'))
    } catch {
      return new Set()
    }
  })
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(`dashboard_hidden_${teamSlug}`, JSON.stringify(Array.from(hiddenWidgetIds)))
    } catch { /* ignore */ }
  }, [hiddenWidgetIds, teamSlug])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hideWidget = useCallback((widgetId: string) => {
    setHiddenWidgetIds((prev: Set<string>) => {
      const next = new Set(prev)
      next.add(widgetId)
      return next
    })
  }, [])

  const showWidget = useCallback((widgetId: string) => {
    setHiddenWidgetIds((prev: Set<string>) => {
      const next = new Set(prev)
      next.delete(widgetId)
      return next
    })
  }, [])

  const availableWidgets = ALL_WIDGET_IDS.filter(id => hiddenWidgetIds.has(id))
  const visibleWidgetIds = DEFAULT_WIDGET_ORDER.filter((id) => !hiddenWidgetIds.has(id))
  const hasHiddenWidgets = availableWidgets.length > 0

  const resetWidgets = useCallback(() => {
    setHiddenWidgetIds(new Set())
  }, [])

  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    query: '',
    status: 'all',
    contentType: 'all',
    playlistId: 'all',
    assetId: 'all',
  }))

  const isFiltering = useMemo(() => {
    return Boolean(
      filters.query.trim() ||
        filters.status !== 'all' ||
        filters.contentType !== 'all' ||
        filters.playlistId !== 'all' ||
        filters.assetId !== 'all'
    )
  }, [filters])

  const filteredDevices = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return devices.filter((d) => {
      if (filters.status !== 'all' && d.status !== filters.status) return false
      if (filters.contentType !== 'all') {
        if (filters.contentType === 'None') {
          if (d.contentType) return false
        } else if (d.contentType !== filters.contentType) {
          return false
        }
      }
      if (filters.playlistId !== 'all') {
        if (d.playlistId !== filters.playlistId) return false
      }
      if (filters.assetId !== 'all') {
        if (d.assetId !== filters.assetId) return false
      }
      if (q) {
        const hay = `${d.name ?? ''} ${d.contentName ?? ''} ${d.contentType ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [devices, filters])

  const derivedCounts = useMemo(() => {
    const totalScreens = filteredDevices.length
    const activeScreens = filteredDevices.filter(d => d.status === 'online').length
    const offlineScreens = filteredDevices.filter(d => d.status === 'offline').length
    const pairingScreens = filteredDevices.filter(d => d.status === 'pairing').length
    return { totalScreens, activeScreens, offlineScreens, pairingScreens }
  }, [filteredDevices])

  function renderWidget(widgetId: string) {
    switch (widgetId) {
      case 'dateTimeStatus':
        return <DateTimeStatusWidget />
      case 'uptime':
        return stats ? <UptimeWidget uptimePercent={stats.uptimePercent} history={uptimeHistory} /> : null
      case 'quickActions':
        return <QuickActionsWidget teamSlug={teamSlug} />
      case 'screensTable':
        return <ScreensTableWidget teamSlug={teamSlug} devices={filteredDevices} />
      case 'alerts':
        return <AlertsWidget alerts={alerts} />
      case 'recentActivity':
        return <RecentActivityWidget activities={activities} />
      case 'statusBreakdown':
        return <StatusBreakdownWidget devices={filteredDevices} />
      case 'topPlaytime':
        return <TopPlaytimeWidget devices={filteredDevices} />
      case 'analyticsOverview':
        return <AnalyticsOverviewWidget data={analytics} />
      case 'deviceHealth':
        return <DeviceHealthWidget devices={deviceHealth} />
      case 'screenUptime':
        return <ScreenUptimeWidget data={screenUptimeData} />
      default:
        return null
    }
  }

  return (
    <div className={styles.dashboardShellClient}>
      <DashboardFiltersBar
        playlistOptions={playlistOptions}
        assetOptions={assetOptions}
        value={filters}
        onChange={setFilters}
      />

      <ActiveScreensWidget
        totalScreens={isFiltering ? derivedCounts.totalScreens : (stats?.totalScreens ?? derivedCounts.totalScreens)}
        activeScreens={isFiltering ? derivedCounts.activeScreens : (stats?.activeScreens ?? derivedCounts.activeScreens)}
        offlineScreens={isFiltering ? derivedCounts.offlineScreens : (stats?.offlineScreens ?? derivedCounts.offlineScreens)}
        pairingScreens={isFiltering ? derivedCounts.pairingScreens : (stats?.pairingScreens ?? derivedCounts.pairingScreens)}
      />

      <div className={styles.gridSectionSection}>
        <div className={styles.gridHeader}>
          <div className={styles.gridHeaderInfo}>
            <OfflineTrendWidget data={offlineTrend} />
          </div>
          <div className={styles.gridControls}>
            <div className={styles.addWidgetWrapper} ref={addMenuRef}>
              <button
                className={styles.addWidgetBtn}
                onClick={() => setShowAddMenu(prev => !prev)}
                title={t('Add Widget')}
              >
                <Plus size={16} />
                {t('Add Widget')}
              </button>
              {showAddMenu && availableWidgets.length > 0 && (
                <div className={styles.addWidgetMenu}>
                  {availableWidgets.map(id => (
                    <button
                      key={id}
                      className={styles.addWidgetMenuItem}
                      onClick={() => { showWidget(id); setShowAddMenu(false) }}
                    >
                      {WIDGET_REGISTRY.get(id)?.title}
                    </button>
                  ))}
                </div>
              )}
              {showAddMenu && availableWidgets.length === 0 && (
                <div className={styles.addWidgetMenu}>
                  <span className={styles.addWidgetMenuEmpty}>{t('All widgets are visible')}</span>
                </div>
              )}
            </div>

            <button
              className={styles.resetWidgetsBtn}
              onClick={resetWidgets}
              title={t('Reset widgets')}
              disabled={!hasHiddenWidgets}
            >
              <RotateCcw size={16} />
              {t('Reset')}
            </button>
          </div>
        </div>

        <div className={styles.widgetsGrid}>
          {visibleWidgetIds.length === 0 ? (
            <div className={styles.widgetsEmpty}>
              <span className={styles.widgetsEmptyTitle}>{t('No widgets selected')}</span>
              <span className={styles.widgetsEmptyHint}>{t('Use “Add Widget” to bring widgets back.')}</span>
            </div>
          ) : null}

          {visibleWidgetIds.map((id) => {
            const def = WIDGET_REGISTRY.get(id)
            const widget = renderWidget(id)
            if (!widget || !def) return null

            return (
              <section
                key={id}
                className={styles.widgetCard}
                style={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ['--widget-span-lg' as any]: String(def.span.lg),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ['--widget-span-md' as any]: String(def.span.md),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ['--widget-span-sm' as any]: String(def.span.sm),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ['--widget-min-height' as any]: `${def.minHeightPx}px`,
                }}
              >
                <button
                  className={styles.widgetCloseBtn}
                  onClick={() => hideWidget(id)}
                  title={t('Remove widget')}
                >
                  ×
                </button>
                <div className={styles.widgetInner}>
                  {widget}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
