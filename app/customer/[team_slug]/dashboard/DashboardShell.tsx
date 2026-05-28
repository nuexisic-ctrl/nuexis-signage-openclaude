'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { LayoutItem } from 'react-grid-layout'
import { Plus, GripVertical } from 'lucide-react'

import { ActiveScreensWidget } from './widgets/activeScreensWidget'
import { OfflineTrendWidget } from './widgets/offlineTrendWidget'
import { UptimeWidget } from './widgets/uptimeWidget'
import { QuickActionsWidget } from './widgets/quickActionsWidget'
import { AlertsWidget } from './widgets/alertsWidget'
import { RecentActivityWidget } from './widgets/recentActivityWidget'
import { ScheduledTimelineWidget } from './widgets/scheduledTimelineWidget'
import { AnalyticsOverviewWidget } from './widgets/analyticsOverviewWidget'
import { DeviceHealthWidget } from './widgets/deviceHealthWidget'
import { ScreenUptimeWidget } from './widgets/screenUptimeWidget'
import { DateTimeStatusWidget } from './widgets/dateTimeStatusWidget'

import type {
  DashboardStats,
  OfflineTrend,
  Alert,
  Activity,
  AnalyticsOverview,
  DeviceHealth,
  ScheduleEvent,
  UptimeDataPoint,
  ScreenUptime,
} from './actions'

import styles from './dashboard.module.css'

interface WidgetDef {
  id: string
  title: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
}

const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  uptime: { id: 'uptime', title: 'App Uptime', defaultSize: { w: 4, h: 2 } },
  quickActions: { id: 'quickActions', title: 'Quick Actions', defaultSize: { w: 2, h: 1 } },
  alerts: { id: 'alerts', title: 'Alerts & Issues', defaultSize: { w: 3, h: 2 } },
  recentActivity: { id: 'recentActivity', title: 'Recent Activity', defaultSize: { w: 4, h: 2 } },
  scheduledTimeline: { id: 'scheduledTimeline', title: 'Scheduled Timeline', defaultSize: { w: 4, h: 2 } },
  analyticsOverview: { id: 'analyticsOverview', title: 'Analytics Overview', defaultSize: { w: 6, h: 2 } },
  deviceHealth: { id: 'deviceHealth', title: 'Device Health', defaultSize: { w: 3, h: 2 } },
  screenUptime: { id: 'screenUptime', title: 'Screen Uptime', defaultSize: { w: 6, h: 2 } },
  dateTimeStatus: { id: 'dateTimeStatus', title: 'Date & Status', defaultSize: { w: 2, h: 1 } },
}

const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)

function getDefaultLayout(): LayoutItem[] {
  return [
    { i: 'dateTimeStatus', x: 10, y: 0, w: 2, h: 1, minW: 2, minH: 1 },
    { i: 'uptime', x: 0, y: 1, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'quickActions', x: 4, y: 1, w: 2, h: 1, minW: 2, minH: 1 },
    { i: 'alerts', x: 6, y: 1, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'recentActivity', x: 0, y: 3, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'deviceHealth', x: 4, y: 3, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'scheduledTimeline', x: 7, y: 3, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'analyticsOverview', x: 0, y: 5, w: 6, h: 2, minW: 4, minH: 2 },
    { i: 'screenUptime', x: 6, y: 5, w: 6, h: 2, minW: 4, minH: 2 },
  ]
}

interface DashboardData {
  stats: DashboardStats | null
  offlineTrend: OfflineTrend
  alerts: Alert[]
  activities: Activity[]
  analytics: AnalyticsOverview
  deviceHealth: DeviceHealth[]
  scheduleEvents: ScheduleEvent[]
  uptimeHistory: UptimeDataPoint[]
  screenUptimeData: ScreenUptime[]
}

interface Props extends DashboardData {
  teamSlug: string
  teamId: string
}

export default function DashboardShell({
  teamSlug,
  stats,
  offlineTrend,
  alerts,
  activities,
  analytics,
  deviceHealth,
  scheduleEvents,
  uptimeHistory,
  screenUptimeData,
}: Props) {
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`dashboard_layout_${teamSlug}`)
        if (saved) return JSON.parse(saved) as LayoutItem[]
      } catch { /* ignore */ }
    }
    return getDefaultLayout()
  })

  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(new Set())
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const visibleLayout = layout.filter((l: LayoutItem) => !hiddenWidgetIds.has(l.i))

  useEffect(() => {
    try {
      localStorage.setItem(`dashboard_layout_${teamSlug}`, JSON.stringify(layout))
    } catch { /* ignore */ }
  }, [layout, teamSlug])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    setLayout([...newLayout])
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
    setLayout((prev: LayoutItem[]) => {
      const exists = prev.find((l: LayoutItem) => l.i === widgetId)
      if (exists) return prev
      const def = WIDGET_REGISTRY[widgetId]
      if (!def) return prev
      const maxY = prev.reduce((max: number, l: LayoutItem) => Math.max(max, l.y + l.h), 0)
      const newItem: LayoutItem = { i: widgetId, x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h }
      if (def.minSize) {
        newItem.minW = def.minSize.w
        newItem.minH = def.minSize.h
      }
      return [...prev, newItem]
    })
  }, [])

  const availableWidgets = ALL_WIDGET_IDS.filter(id => hiddenWidgetIds.has(id))

  function renderWidget(widgetId: string) {
    switch (widgetId) {
      case 'dateTimeStatus':
        return <DateTimeStatusWidget />
      case 'uptime':
        return stats ? <UptimeWidget uptimePercent={stats.uptimePercent} history={uptimeHistory} /> : null
      case 'quickActions':
        return <QuickActionsWidget teamSlug={teamSlug} />
      case 'alerts':
        return <AlertsWidget alerts={alerts} />
      case 'recentActivity':
        return <RecentActivityWidget activities={activities} />
      case 'scheduledTimeline':
        return <ScheduledTimelineWidget events={scheduleEvents} />
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
      <ActiveScreensWidget
        totalScreens={stats?.totalScreens ?? 0}
        activeScreens={stats?.activeScreens ?? 0}
        offlineScreens={stats?.offlineScreens ?? 0}
        pairingScreens={stats?.pairingScreens ?? 0}
      />

      <div className={styles.gridSection}>
        <div className={styles.gridHeader}>
          <div className={styles.gridHeaderInfo}>
            <OfflineTrendWidget data={offlineTrend} />
          </div>
          <div className={styles.gridControls}>
            <div className={styles.addWidgetWrapper} ref={addMenuRef}>
              <button
                className={styles.addWidgetBtn}
                onClick={() => setShowAddMenu(prev => !prev)}
                title="Add Widget"
              >
                <Plus size={16} />
                Add Widget
              </button>
              {showAddMenu && availableWidgets.length > 0 && (
                <div className={styles.addWidgetMenu}>
                  {availableWidgets.map(id => (
                    <button
                      key={id}
                      className={styles.addWidgetMenuItem}
                      onClick={() => { showWidget(id); setShowAddMenu(false) }}
                    >
                      {WIDGET_REGISTRY[id].title}
                    </button>
                  ))}
                </div>
              )}
              {showAddMenu && availableWidgets.length === 0 && (
                <div className={styles.addWidgetMenu}>
                  <span className={styles.addWidgetMenuEmpty}>All widgets are visible</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <GridLayout
          className={styles.gridLayout}
          layout={visibleLayout}
          width={1200}
          onLayoutChange={handleLayoutChange}
          gridConfig={{
            cols: 12,
            rowHeight: 90,
            margin: [14, 14] as const,
            containerPadding: [0, 0] as const,
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: true,
            handle: '.widget-drag-handle',
            bounded: false,
            threshold: 3,
          }}
          resizeConfig={{
            enabled: true,
            handles: ['se'] as const,
          }}
        >
          {visibleLayout.map((l: LayoutItem) => (
            <div key={l.i} className={styles.gridWidget}>
              <div className={`${styles.widgetDragHandle} widget-drag-handle`}>
                <GripVertical size={12} />
              </div>
              <button
                className={styles.widgetCloseBtn}
                onClick={() => hideWidget(l.i)}
                title="Remove widget"
              >
                ×
              </button>
              <div className={styles.widgetInner}>
                {renderWidget(l.i)}
              </div>
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  )
}
