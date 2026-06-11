import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ScreensClient from './ScreensClient'
import styles from './screens.module.css'

interface Props {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Screens — ${team_slug} | NuExis`,
    description: 'Manage and pair digital displays for your workspace.',
  }
}

export default async function ScreensPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  // Use getCachedUser() — deduplicates the auth/v1/user call shared with middleware
  // so this page navigation only fires one auth request instead of two.
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get the user's team_id, role, and team slug securely from their profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug, historical_playtime_seconds)')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[ScreensPage] Failed to load profile:', profileError.message)
  }

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/screens`)
  }

  const userRole = profile?.role || 'Owner'

  // Execute all screen-related queries concurrently to eliminate waterfall delays.
  // Wrapped in try/catch — if any query times out (authenticated role has 8s statement_timeout)
  // or fails transiently, fall back to empty arrays instead of crashing the server render.
  let devices: any[] = []
  let totalScreens = 0
  let assets: any[] = []
  let playlists: any[] = []
  let groups: any[] = []
  let memberships: any[] = []

  if (profile?.team_id) {
    try {
      const [response, assetsRes, playlistsRes, groupsRes, membershipsRes] = await Promise.all([
        supabase
          .from('devices')
          .select('id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds', { count: 'exact' })
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('assets')
          .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('playlists')
          .select('id, name, created_at, playlist_items(duration_seconds, widget_type, assets(mime_type))')
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('screen_groups')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('name', { ascending: true })
          .limit(200),
        supabase
          .from('screen_group_members')
          .select('group_id, device_id, is_primary')
          .eq('team_id', profile.team_id)
          .limit(2000),
      ])

      if (response.error) {
        console.error('[ScreensPage] devices query error:', response.error.message)
      } else {
        totalScreens = response.count ?? 0
        devices = (response.data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          created_at: d.created_at,
          content_type: d.content_type,
          asset_id: d.asset_id,
          playlist_id: d.playlist_id,
          orientation: d.orientation,
          status: d.status as 'online' | 'offline' | 'pairing',
          last_seen_at: d.last_seen_at || null,
          total_playtime_seconds: d.total_playtime_seconds || 0,
        }))
      }

      if (!assetsRes.error) assets = assetsRes.data ?? []
      else console.error('[ScreensPage] assets query error:', assetsRes.error.message)

      if (!playlistsRes.error) playlists = playlistsRes.data ?? []
      else console.error('[ScreensPage] playlists query error:', playlistsRes.error.message)

      if (!groupsRes.error) groups = groupsRes.data ?? []
      else console.error('[ScreensPage] groups query error:', groupsRes.error.message)

      if (!membershipsRes.error) memberships = membershipsRes.data ?? []
      else console.error('[ScreensPage] memberships query error:', membershipsRes.error.message)

    } catch (err: any) {
      // Transient error (e.g. statement_timeout, network hiccup). Log and render with
      // empty data so the user sees the page rather than a crash screen.
      console.error('[ScreensPage] Concurrent query batch failed:', err?.message ?? err)
    }
  }

  const historicalPlaytime = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).historical_playtime_seconds : 0

  return (
    <ScreensClient
      devices={devices}
      assets={assets}
      playlists={playlists}
      groups={groups}
      memberships={memberships}
      teamSlug={team_slug}
      teamId={profile?.team_id as string}
      totalScreens={totalScreens}
      historicalPlaytime={Number(historicalPlaytime) || 0}
    />
  )
}
