'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import type { Layout, ResponsiveLayouts as Layouts } from 'react-grid-layout/legacy'
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

const ResponsiveGridLayout = WidthProvider(Responsive)

type LayoutItem = Layout[number]

interface WidgetDef {
  id: string
  title: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const

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

function getDefaultLayout(): Layout {
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

function normalizeLayoutForCols(layout: Layout, cols: number): Layout {
  return layout.map((item) => {
    const w = Math.min(item.w, cols)
    const minW = item.minW ? Math.min(item.minW, cols) : undefined
    const x = Math.max(0, Math.min(item.x, cols - w))
    return { ...item, w, x, minW }
  })
}

function buildResponsiveLayouts(base: Layout): Layouts {
  return {
    lg: normalizeLayoutForCols(base, COLS.lg),
    md: normalizeLayoutForCols(base, COLS.md),
    sm: normalizeLayoutForCols(base, COLS.sm),
    xs: normalizeLayoutForCols(base, COLS.xs),
    xxs: normalizeLayoutForCols(base, COLS.xxs),
  }
}

function filterHiddenFromLayouts(layouts: Layouts, hidden: Set<string>): Layouts {
  const filter = (arr: Layout | undefined) => (arr ?? []).filter((l) => !hidden.has(l.i))
  return {
    lg: filter(layouts.lg),
    md: filter(layouts.md),
    sm: filter(layouts.sm),
    xs: filter(layouts.xs),
    xxs: filter(layouts.xxs),
  }
}

function mergeVisibleLayouts(prev: Layouts, nextVisible: Layouts, hidden: Set<string>): Layouts {
  const mergeForBreakpoint = (bp: keyof typeof COLS): Layout => {
    const prevArr = prev[bp] ?? []
    const nextArr = nextVisible[bp] ?? []
    const nextVisibleIds = new Set(nextArr.map((l: LayoutItem) => l.i))
    const hiddenArr = prevArr.filter((l: LayoutItem) => hidden.has(l.i) && !nextVisibleIds.has(l.i))
    return [...hiddenArr, ...nextArr]
  }

  return {
    lg: mergeForBreakpoint('lg'),
    md: mergeForBreakpoint('md'),
    sm: mergeForBreakpoint('sm'),
    xs: mergeForBreakpoint('xs'),
    xxs: mergeForBreakpoint('xxs'),
  }
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
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsSmallScreen(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const [layouts, setLayouts] = useState<Layouts>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`dashboard_layout_${teamSlug}`)
        if (saved) {
          const parsed = JSON.parse(saved) as unknown
          // Backwards compatibility: older versions stored a single Layout[].
          if (Array.isArray(parsed)) return buildResponsiveLayouts(parsed as any)
          if (parsed && typeof parsed === 'object') {
            const p = parsed as Partial<Layouts>
            const base = (p.lg && Array.isArray(p.lg) ? (p.lg as any) : null) ?? getDefaultLayout()
            return {
              ...buildResponsiveLayouts(base),
              ...Object.fromEntries(
                (Object.keys(COLS) as Array<keyof typeof COLS>).map((bp) => [
                  bp,
                  Array.isArray(p[bp]) ? normalizeLayoutForCols(p[bp] as any, COLS[bp]) : undefined,
                ])
              ),
            } as Layouts
          }
        }
      } catch { /* ignore */ }
    }
    return buildResponsiveLayouts(getDefaultLayout())
  })

  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(new Set())
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const visibleLayouts = useMemo(() => {
    return filterHiddenFromLayouts(layouts, hiddenWidgetIds)
  }, [layouts, hiddenWidgetIds])

  useEffect(() => {
    try {
      localStorage.setItem(`dashboard_layout_${teamSlug}`, JSON.stringify(layouts))
    } catch { /* ignore */ }
  }, [layouts, teamSlug])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLayoutChange = useCallback((_: Layout, allLayouts: Layouts) => {
    setLayouts((prev) => mergeVisibleLayouts(prev, allLayouts, hiddenWidgetIds))
  }, [hiddenWidgetIds])

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
    setLayouts((prev) => {
      const def = WIDGET_REGISTRY[widgetId]
      if (!def) return prev

      const next: Layouts = { ...prev }
      ;(Object.keys(COLS) as Array<keyof typeof COLS>).forEach((bp) => {
        const cols = COLS[bp]
        const arr = [...(prev[bp] ?? [])]
        const exists = arr.some((l: any) => l.i === widgetId)
        if (exists) {
          next[bp] = arr as any
          return
        }

        const maxY = arr.reduce((max: number, l: any) => Math.max(max, (l.y ?? 0) + (l.h ?? 0)), 0)
        const w = Math.min(def.defaultSize.w, cols)
        const newItem: any = { i: widgetId, x: 0, y: maxY, w, h: def.defaultSize.h }
        if (def.minSize) {
          newItem.minW = Math.min(def.minSize.w, cols)
          newItem.minH = def.minSize.h
        }
        next[bp] = [...arr, newItem] as any
      })
      return next
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

        {isMounted ? (
          <ResponsiveGridLayout
            className={styles.gridLayout}
            layouts={visibleLayouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={90}
            margin={[14, 14]}
            containerPadding={[0, 0]}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            isDraggable={!isSmallScreen}
            isResizable={!isSmallScreen}
            resizeHandles={['se']}
          >
            {(visibleLayouts.lg ?? []).map((l: any) => (
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
          </ResponsiveGridLayout>
        ) : (
          <div className={styles.gridLayout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ opacity: 0.5 }}>Loading layout...</span>
          </div>
        )}
      </div>
    </div>
  )
}
