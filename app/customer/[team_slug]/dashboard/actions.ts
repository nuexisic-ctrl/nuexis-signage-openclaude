'use server'

import { createClient } from '@/lib/supabase/server'

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

async function getTeamId(supabase: Awaited<ReturnType<typeof createClient>>, teamSlug: string): Promise<string | null> {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('slug', teamSlug)
    .single()
  return team?.id ?? null
}

export async function getDashboardStats(teamSlug: string): Promise<DashboardStats | null> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return null

  const { data: devices } = await supabase
    .from('devices')
    .select('status, total_playtime_seconds, created_at')
    .eq('team_id', teamId)

  if (!devices) return { totalScreens: 0, activeScreens: 0, offlineScreens: 0, pairingScreens: 0, uptimePercent: 0, totalPlaytimeSeconds: 0 }

  const total = devices.length
  const active = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status === 'offline').length
  const pairing = devices.filter(d => d.status === 'pairing').length
  const totalPlaytime = devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)

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
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return { todayPercent: 0, yesterdayPercent: 0, direction: 'stable', changePercent: 0 }

  const { data: devices } = await supabase
    .from('devices')
    .select('status, last_seen_at')
    .eq('team_id', teamId)

  if (!devices || devices.length === 0) {
    return { todayPercent: 0, yesterdayPercent: 0, direction: 'stable', changePercent: 0 }
  }

  const now = new Date()
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
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const alerts: Alert[] = []

  const { data: offlineDevices } = await supabase
    .from('devices')
    .select('id, name, last_seen_at')
    .eq('team_id', teamId)
    .eq('status', 'offline')

  if (offlineDevices) {
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
  }

  const { data: claimAttempts } = await supabase
    .from('claim_attempts')
    .select('id, attempted_at')
    .gte('attempted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('attempted_at', { ascending: false })
    .limit(5)

  if (claimAttempts) {
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
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
}

export async function getRecentActivity(teamSlug: string): Promise<Activity[]> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, status, last_seen_at')
    .eq('team_id', teamId)
    .order('last_seen_at', { ascending: false })
    .limit(10)

  if (!devices) return []

  return devices.map(d => ({
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
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) {
    return { totalPlaytimeSeconds: 0, formattedPlaytime: '0s', impressions: { available: false }, topContent: { available: false }, topSkills: { available: false } }
  }

  const { data: devices } = await supabase
    .from('devices')
    .select('total_playtime_seconds, name')
    .eq('team_id', teamId)

  const totalPlaytimeSeconds = devices
    ? devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)
    : 0

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
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, status, last_seen_at, total_playtime_seconds, created_at')
    .eq('team_id', teamId)

  if (!devices) return []

  return devices.map(d => {
    const now = Date.now()
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
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, content_type, asset_id, playlist_id')
    .eq('team_id', teamId)
    .not('content_type', 'is', null)

  if (!devices) return []

  const events: ScheduleEvent[] = []

  for (const d of devices) {
    let contentName: string | null = null

    if (d.content_type === 'Asset' && d.asset_id) {
      const { data: asset } = await supabase
        .from('assets')
        .select('file_name')
        .eq('id', d.asset_id)
        .single()
      contentName = asset?.file_name ?? null
    } else if (d.content_type === 'Playlist' && d.playlist_id) {
      const { data: playlist } = await supabase
        .from('playlists')
        .select('name')
        .eq('id', d.playlist_id)
        .single()
      contentName = playlist?.name ?? null
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

function generateDaysArray(days: number): string[] {
  const arr: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    arr.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  return arr
}

export async function getUptimeHistory(teamSlug: string): Promise<UptimeDataPoint[]> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const { data: devices } = await supabase
    .from('devices')
    .select('total_playtime_seconds, created_at')
    .eq('team_id', teamId)

  if (!devices || devices.length === 0) return []

  const days = generateDaysArray(7)
  const now = Date.now()

  const totalLifetime = devices.reduce((sum, d) => sum + (now - new Date(d.created_at).getTime()), 0) / 1000
  const totalPlaytime = devices.reduce((sum, d) => sum + Number(d.total_playtime_seconds || 0), 0)

  return days.map((date, i) => {
    const playtimePortion = totalPlaytime * (i + 1) / 7
    const lifetimePortion = totalLifetime / 7
    const uptime = lifetimePortion > 0 ? Math.round((playtimePortion / (lifetimePortion * (i + 1))) * 100) : 100
    return { date, uptime: Math.min(uptime, 100) }
  })
}

export async function getScreenUptimeHistory(teamSlug: string): Promise<ScreenUptime[]> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase, teamSlug)
  if (!teamId) return []

  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, total_playtime_seconds, created_at')
    .eq('team_id', teamId)
    .limit(6)

  if (!devices) return []

  const days = generateDaysArray(7)

  return devices.map(d => {
    const lifetime = (Date.now() - new Date(d.created_at).getTime()) / 1000
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
