import type { Metadata } from 'next'
import { cookies } from 'next/headers'
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug, historical_playtime_seconds)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/screens`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  const userRole = profile?.role || 'Owner'

  const query = supabase
    .from('devices')
    .select('id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds', { count: 'exact' })
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .limit(1000)

  // Execute all screen-related queries concurrently to eliminate waterfall delays
  const [response, assetsRes, playlistsRes, groupsRes, membershipsRes] = await Promise.all([
    profile?.team_id ? query : Promise.resolve({ data: [], count: 0, error: null }),
    profile?.team_id
      ? supabase
          .from('assets')
          .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    profile?.team_id
      ? supabase
          .from('playlists')
          .select('id, name, created_at, playlist_items(duration_seconds, widget_type, assets(mime_type))')
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    profile?.team_id
      ? supabase
          .from('screen_groups')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    profile?.team_id
      ? supabase
          .from('screen_group_members')
          .select('group_id, device_id, is_primary')
          .eq('team_id', profile.team_id)
      : Promise.resolve({ data: [], error: null })
  ])

  const devicesData = response.data ?? []
  const totalScreens = response.count ?? 0

  const devices = devicesData.map((d) => {
    return {
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
    }
  })

  const assets = assetsRes.data ?? []
  const playlists = playlistsRes.data ?? []
  const groups = groupsRes.data ?? []
  const memberships = membershipsRes.data ?? []
  const historicalPlaytime = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).historical_playtime_seconds : 0

  const cookieStore = await cookies()
  const initialViewMode = (cookieStore.get('screens_view_mode')?.value as 'grid' | 'table') || 'table'

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
      initialViewMode={initialViewMode}
    />
  )
}
