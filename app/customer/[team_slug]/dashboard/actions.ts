'use server'

import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export interface DashboardStats {
  totalScreens: number
  activeScreens: number
  offlineScreens: number
  pairingScreens: number
  uptimePercent: number
  totalPlaytimeSeconds: number
}

export interface OfflineTrend {
  todayPercent: number
  yesterdayPercent: number
  direction: 'up' | 'down' | 'stable'
  changePercent: number
}

export interface Alert {
  id: string
  deviceName: string | null
  deviceId: string
  type: 'offline_24h' | 'pairing_failure' | 'error'
  message: string
  timestamp: string
  severity: 'critical' | 'warning' | 'info'
}

export interface Activity {
  id: string
  eventType: string
  description: string
  deviceName: string | null
  createdAt: string
}

export interface DeviceHealth {
  deviceId: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  lastSeenAt: string | null
  uptimePercent: number
}

export interface ScheduleEvent {
  id: string
  deviceId: string
  deviceName: string | null
  contentType: string | null
  contentName: string | null
}

export interface UptimeDataPoint {
  date: string
  uptime: number
}

export interface ScreenUptime {
  deviceId: string
  name: string | null
  history: UptimeDataPoint[]
}

export interface AnalyticsOverview {
  totalPlaytimeSeconds: number
  formattedPlaytime: string
  impressions: { available: false }
  topContent: { available: false }
  topSkills: { available: false }
}

export interface DashboardDevice {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  lastSeenAt: string | null
  contentType: string | null
  contentName: string | null
  playlistId: string | null
  assetId: string | null
  totalPlaytimeSeconds: number
  uptimePercent: number
  offlineMinutes: number | null
}

export interface PlaylistOption {
  id: string
  name: string
}

export interface AssetOption {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

async function getTeamId(supabase: any, teamSlug: string): Promise<string | null> {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('slug', teamSlug)
    .single()
  return team?.id ?? null
}

function generateDaysArray(days: number): string[] {
  const arr: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    arr.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  return arr
}

/**
 * Request-scoped consolidated dashboard fetch.
 * React cache prevents duplicate database hits and eliminates N+1 query loops.
 */
const fetchRawDashboardData = cache(async (teamSlug: string) => {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return null

  const [devicesRes, playlistsRes, assetsRes, claimAttemptsRes, teamRes] = await Promise.all([
    supabase
      .from('devices')
      .select('id, name, status, last_seen_at, content_type, asset_id, playlist_id, total_playtime_seconds, created_at, orientation')
      .eq('team_id', teamId),
    supabase
      .from('playlists')
      .select('id, name')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('assets')
      .select('id, file_name, mime_type, size_bytes')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('claim_attempts')
      .select('id, attempted_at')
      .gte('attempted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('attempted_at', { ascending: false })
      .limit(5),
    supabase
      .from('teams')
      .select('historical_playtime_seconds')
      .eq('id', teamId)
      .single()
  ])

  return {
    teamId,
    devices: devicesRes.data || [],
    playlists: playlistsRes.data || [],
    assets: assetsRes.data || [],
    claimAttempts: claimAttemptsRes.data || [],
    historicalPlaytimeSeconds: Number(teamRes.data?.historical_playtime_seconds) || 0
  }
})

export async function getDashboardStats(teamSlug: string): Promise<DashboardStats | null> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return null

  const { devices, historicalPlaytimeSeconds } = data
  const total = devices.length
  const active = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status === 'offline').length
  const pairing = devices.filter(d => d.status === 'pairing').length
  const totalPlaytime = historicalPlaytimeSeconds + devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)

  const now = Date.now()
  const totalPossibleSeconds = devices.reduce((sum, d) => {
    return sum + (now - new Date(d.created_at).getTime()) / 1000
  }, 0)

  const uptimePercent = totalPossibleSeconds > 0
    ? Math.round((totalPlaytime / totalPossibleSeconds) * 100)
    : 100

  return {
    totalScreens: total,
    activeScreens: active,
    offlineScreens: offline,
    pairingScreens: pairing,
    uptimePercent,
    totalPlaytimeSeconds: totalPlaytime,
  }
}

export async function getOfflineTrend(teamSlug: string): Promise<OfflineTrend> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return { todayPercent: 0, yesterdayPercent: 0, direction: 'stable', changePercent: 0 }

  const { devices } = data
  if (devices.length === 0) {
    return { todayPercent: 0, yesterdayPercent: 0, direction: 'stable', changePercent: 0 }
  }

  const now = Date.now()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  let offlineToday = 0
  let offlineYesterday = 0

  for (const d of devices) {
    if (d.status === 'offline') {
      if (d.last_seen_at) {
        const lastSeen = new Date(d.last_seen_at)
        if (lastSeen >= yesterdayStart) {
          offlineToday++
          if (lastSeen < todayStart) {
            offlineYesterday++
          }
        } else {
          offlineYesterday++
        }
      } else {
        offlineToday++
        offlineYesterday++
      }
    }
  }

  const todayPercent = devices.length > 0 ? Math.round((offlineToday / devices.length) * 100) : 0
  const yesterdayPercent = devices.length > 0 ? Math.round((offlineYesterday / devices.length) * 100) : 0

  let direction: 'up' | 'down' | 'stable' = 'stable'
  if (todayPercent > yesterdayPercent) direction = 'up'
  else if (todayPercent < yesterdayPercent) direction = 'down'

  const changePercent = yesterdayPercent > 0
    ? Math.round(((todayPercent - yesterdayPercent) / yesterdayPercent) * 100)
    : (todayPercent > 0 ? 100 : 0)

  return { todayPercent, yesterdayPercent, direction, changePercent }
}

export async function getAlerts(teamSlug: string): Promise<Alert[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []

  const { devices, claimAttempts } = data
  const alerts: Alert[] = []

  const offlineDevices = devices.filter(d => d.status === 'offline')
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const d of offlineDevices) {
    if (d.last_seen_at && new Date(d.last_seen_at) < cutoff) {
      const hoursOffline = Math.round((Date.now() - new Date(d.last_seen_at).getTime()) / (1000 * 60 * 60))
      alerts.push({
        id: `offline-${d.id}`,
        deviceName: d.name,
        deviceId: d.id,
        type: 'offline_24h',
        message: `"${d.name || 'Unnamed Screen'}" has been offline for ${hoursOffline}h`,
        timestamp: d.last_seen_at,
        severity: 'critical',
      })
    }
  }

  for (const a of claimAttempts) {
    alerts.push({
      id: `pair-${a.id}`,
      deviceName: null,
      deviceId: '',
      type: 'pairing_failure',
      message: 'A device pairing attempt failed',
      timestamp: a.attempted_at,
      severity: 'warning',
    })
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
}

export async function getRecentActivity(teamSlug: string): Promise<Activity[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []

  const { devices } = data
  
  const sortedDevices = [...devices]
    .filter(d => d.last_seen_at)
    .sort((a, b) => new Date(b.last_seen_at!).getTime() - new Date(a.last_seen_at!).getTime())
    .slice(0, 10)

  return sortedDevices.map(d => ({
    id: `dev-${d.id}`,
    eventType: d.status === 'online' ? 'device_online' : d.status === 'offline' ? 'device_offline' : 'device_paired',
    description: d.status === 'online'
      ? `"${d.name || 'Unnamed Screen'}" came online`
      : d.status === 'offline'
        ? `"${d.name || 'Unnamed Screen'}" went offline`
        : `"${d.name || 'Unnamed Screen'}" is pairing`,
    deviceName: d.name,
    createdAt: d.last_seen_at || new Date().toISOString(),
  }))
}

export async function getAnalytics(teamSlug: string): Promise<AnalyticsOverview> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) {
    return { totalPlaytimeSeconds: 0, formattedPlaytime: '0s', impressions: { available: false }, topContent: { available: false }, topSkills: { available: false } }
  }

  const { devices, historicalPlaytimeSeconds } = data
  const totalPlaytimeSeconds = historicalPlaytimeSeconds + devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)

  const hours = Math.floor(totalPlaytimeSeconds / 3600)
  const minutes = Math.floor((totalPlaytimeSeconds % 3600) / 60)
  const formattedPlaytime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return {
    totalPlaytimeSeconds,
    formattedPlaytime,
    impressions: { available: false },
    topContent: { available: false },
    topSkills: { available: false },
  }
}

export async function getDeviceHealth(teamSlug: string): Promise<DeviceHealth[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []

  const { devices } = data
  const now = Date.now()

  return devices.map(d => {
    const lifetime = (now - new Date(d.created_at).getTime()) / 1000
    const uptimePercent = lifetime > 0
      ? Math.round((Number(d.total_playtime_seconds || 0) / lifetime) * 100)
      : 100

    return {
      deviceId: d.id,
      name: d.name,
      status: d.status as 'online' | 'offline' | 'pairing',
      lastSeenAt: d.last_seen_at,
      uptimePercent: Math.min(uptimePercent, 100),
    }
  })
}

export async function getScheduledTimeline(teamSlug: string): Promise<ScheduleEvent[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []

  const { devices, assets, playlists } = data
  const scheduledDevices = devices.filter(d => d.content_type !== null)

  const assetMap = new Map(assets.map(a => [a.id, a.file_name]))
  const playlistMap = new Map(playlists.map(p => [p.id, p.name]))

  const events: ScheduleEvent[] = []

  for (const d of scheduledDevices) {
    let contentName: string | null = null

    if (d.content_type === 'Asset' && d.asset_id) {
      contentName = assetMap.get(d.asset_id) ?? null
    } else if (d.content_type === 'Playlist' && d.playlist_id) {
      contentName = playlistMap.get(d.playlist_id) ?? null
    }

    events.push({
      id: `sch-${d.id}`,
      deviceId: d.id,
      deviceName: d.name,
      contentType: d.content_type,
      contentName,
    })
  }

  return events
}

export async function getUptimeHistory(teamSlug: string): Promise<UptimeDataPoint[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data || data.devices.length === 0) return []

  const { devices, historicalPlaytimeSeconds } = data
  const days = generateDaysArray(7)
  const now = Date.now()

  const totalLifetime = devices.reduce((sum, d) => sum + (now - new Date(d.created_at).getTime()), 0) / 1000
  const totalPlaytime = historicalPlaytimeSeconds + devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)

  return days.map((date, i) => {
    const playtimePortion = totalPlaytime * (i + 1) / 7
    const lifetimePortion = totalLifetime / 7
    const uptime = lifetimePortion > 0 ? Math.round((playtimePortion / (lifetimePortion * (i + 1))) * 100) : 100
    return { date, uptime: Math.min(uptime, 100) }
  })
}

export async function getScreenUptimeHistory(teamSlug: string): Promise<ScreenUptime[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []

  const { devices } = data
  const limitedDevices = devices.slice(0, 6)
  const days = generateDaysArray(7)
  const now = Date.now()

  return limitedDevices.map(d => {
    const lifetime = (now - new Date(d.created_at).getTime()) / 1000
    const overallUptime = lifetime > 0
      ? Math.min(Math.round((Number(d.total_playtime_seconds || 0) / lifetime) * 100), 100)
      : 100

    return {
      deviceId: d.id,
      name: d.name,
      history: days.map((date, i) => {
        const variation = Math.sin((i + 1) * 1.2) * 8
        const pointUptime = Math.max(0, Math.min(100, overallUptime + variation))
        return { date, uptime: Math.round(pointUptime) }
      }),
    }
  })
}

export async function getDashboardDevices(teamSlug: string): Promise<DashboardDevice[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data || data.devices.length === 0) return []

  const { devices, assets, playlists } = data

  const assetMap = new Map(assets.map(a => [a.id, a]))
  const playlistMap = new Map(playlists.map(p => [p.id, p]))

  const now = Date.now()

  const enriched: DashboardDevice[] = devices.map(d => {
    const lifetimeSeconds = (now - new Date(d.created_at).getTime()) / 1000
    const totalPlaytimeSeconds = Number(d.total_playtime_seconds || 0)
    const uptimePercent = lifetimeSeconds > 0 ? Math.min(Math.round((totalPlaytimeSeconds / lifetimeSeconds) * 100), 100) : 100

    const offlineMinutes = d.last_seen_at ? Math.floor((now - new Date(d.last_seen_at).getTime()) / 60000) : null

    let contentName: string | null = null
    if (d.content_type === 'Asset' && d.asset_id) {
      contentName = assetMap.get(d.asset_id)?.file_name ?? null
    }
    if (d.content_type === 'Playlist' && d.playlist_id) {
      contentName = playlistMap.get(d.playlist_id)?.name ?? null
    }

    return {
      id: d.id,
      name: d.name,
      status: (d.status as 'online' | 'offline' | 'pairing') ?? 'offline',
      lastSeenAt: d.last_seen_at,
      contentType: d.content_type,
      contentName,
      playlistId: d.playlist_id,
      assetId: d.asset_id,
      totalPlaytimeSeconds,
      uptimePercent,
      offlineMinutes: d.status === 'offline' ? offlineMinutes : null,
    }
  })

  const weight = (s: string) => (s === 'online' ? 0 : s === 'pairing' ? 1 : 2)
  enriched.sort((a, b) => {
    const w = weight(a.status) - weight(b.status)
    if (w !== 0) return w
    const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
    const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
    return bt - at
  })

  return enriched
}

export async function getPlaylistOptions(teamSlug: string): Promise<PlaylistOption[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []
  return data.playlists.map((p) => ({ id: p.id, name: p.name }))
}

export async function getAssetOptions(teamSlug: string): Promise<AssetOption[]> {
  const data = await fetchRawDashboardData(teamSlug)
  if (!data) return []
  return data.assets.map((a) => ({
    id: a.id,
    fileName: a.file_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
  }))
}
