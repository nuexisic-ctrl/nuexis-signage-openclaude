import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PlaylistWorkspace from './PlaylistWorkspace'

interface Props {
  params: Promise<{ team_slug: string; playlistId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug, playlistId } = await params
  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) {
    return { title: `Campaigns — ${team_slug} | NuExis` }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { title: `Campaigns — ${team_slug} | NuExis` }
  }

  const { data: playlist } = await supabase
    .from('playlists')
    .select('name')
    .eq('id', playlistId)
    .eq('team_id', teamId)
    .single()

  const name = playlist?.name || 'Campaign'
  return {
    title: `${name} — Campaigns | NuExis`,
    description: `Edit and manage the "${name}" campaign.`,
  }
}

export default async function PlaylistDetailPage({ params }: Props) {
  const { team_slug, playlistId } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  // Validate UUID format to avoid unnecessary DB round-trip
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlistId)) {
    notFound()
  }

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get team_id from JWT app_metadata — never trust client-supplied values
  const teamId = user.app_metadata?.team_id as string | undefined

  // Verify team membership
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).slug : undefined

  if (!profile || !profile.team_id || !userTeamSlug || userTeamSlug !== team_slug || !teamId) {
    notFound()
  }

  // Fetch playlist header — cross-team UUID guess returns not found (no info leak)
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id, name, color, created_at, updated_at, version')
    .eq('id', playlistId)
    .eq('team_id', teamId)
    .single()

  if (playlistError || !playlist) {
    notFound()
  }

  // Fetch items with asset details
  const { data: items } = await supabase
    .from('playlist_items')
    .select('id, playlist_id, type, asset_id, widget_type, widget_config, duration_seconds, sort_order, created_at, assets(id, file_name, file_path, mime_type, size_bytes, width, height)')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })

  const typedItems = (items || []) as any[]

  // Compute summary from loaded items
  let totalSizeBytes = 0
  let totalDurationSeconds = 0
  for (const item of typedItems) {
    totalDurationSeconds += item.duration_seconds || 0
    if (item.assets?.size_bytes) {
      totalSizeBytes += item.assets.size_bytes
    }
  }

  // Fetch assigned devices & assets concurrently (limit assets picker to 200)
  const [assignedDevicesRes, assetsRes] = await Promise.all([
    supabase
      .from('devices')
      .select('id, name, status')
      .eq('team_id', teamId)
      .eq('playlist_id', playlistId),
    supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color, width, height')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(200)
  ])

  const assignedDevices = assignedDevicesRes.data ?? []
  const assets = assetsRes.data ?? []

  return (
    <PlaylistWorkspace
      initialData={{
        id: playlist.id,
        name: playlist.name || '',
        color: playlist.color || '#3b82f6',
        created_at: playlist.created_at || '',
        updated_at: playlist.updated_at || '',
        version: playlist.version ?? 0,
        items: typedItems,
        summary: {
          totalItems: typedItems.length,
          totalSizeBytes,
          totalDurationSeconds,
        },
        assignedDevices: (assignedDevices || []) as any[],
      }}
      teamSlug={team_slug}
      teamId={teamId}
      userRole={profile.role || 'Owner'}
      assets={(assets || []) as any[]}
    />
  )
}
