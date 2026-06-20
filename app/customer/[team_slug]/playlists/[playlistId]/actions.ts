'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimitAction } from '@/lib/redis'
import type { Json } from '@/types/supabase'

// ── Auth helper ─────────────────────────────────────────────────────────
async function getAuthenticatedTeamId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('You must be logged in to manage playlists.')
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    throw new Error('Could not determine your team. Please try again.')
  }

  return { user, teamId }
}

// ── Types ───────────────────────────────────────────────────────────────

export interface PlaylistEditorData {
  id: string
  name: string
  version: number
  color?: string
  created_at: string
  updated_at: string
  items: PlaylistItemWithAsset[]
  summary: {
    totalItems: number
    totalSizeBytes: number
    totalDurationSeconds: number
  }
  assignedDevices: AssignedDevice[]
}

export interface PlaylistItemWithAsset {
  id: string
  playlist_id: string
  type: string
  asset_id: string | null
  widget_type: string | null
  widget_config: unknown
  duration_seconds: number
  sort_order: number
  created_at: string
  assets: {
    id: string
    file_name: string
    file_path: string
    mime_type: string
    size_bytes: number
    width: number | null
    height: number | null
  } | null
}

export interface AssignedDevice {
  id: string
  name: string | null
  status: string
}

// ── Actions ─────────────────────────────────────────────────────────────

export async function getPlaylistForEditor(playlistId: string): Promise<PlaylistEditorData> {
  const supabase = await createClient()
  const { teamId } = await getAuthenticatedTeamId(supabase)

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlistId)) {
    throw new Error('Invalid playlist ID.')
  }

  // Fetch playlist header
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id, name, color, version, created_at, updated_at')
    .eq('id', playlistId)
    .eq('team_id', teamId)
    .single()

  if (playlistError || !playlist) {
    throw new Error('Playlist not found or access denied.')
  }

  // Fetch items with asset details
  const { data: items, error: itemsError } = await supabase
    .from('playlist_items')
    .select('id, playlist_id, type, asset_id, widget_type, widget_config, duration_seconds, sort_order, created_at, assets(id, file_name, file_path, mime_type, size_bytes, width, height)')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    throw new Error('Failed to load playlist items.')
  }

  const typedItems = (items || []) as unknown as PlaylistItemWithAsset[]

  // Fetch summary from database RPC
  const { data: summaryResult, error: summaryError } = await supabase
    .rpc('get_playlist_summary', { p_playlist_id: playlistId })

  const summary = (summaryResult as any) || {
    total_items: 0,
    total_duration_seconds: 0,
    total_size_bytes: 0
  }

  const summaryPayload = {
    totalItems: summary.total_items || 0,
    totalSizeBytes: summary.total_size_bytes || 0,
    totalDurationSeconds: summary.total_duration_seconds || 0
  }

  // Fetch assigned devices (directly or via groups)
  const { data: directDevices } = await supabase
    .from('devices')
    .select('id, name, status')
    .eq('team_id', teamId)
    .eq('playlist_id', playlistId)

  const assignedDevices = (directDevices || []) as AssignedDevice[]

  return {
    id: playlist.id,
    name: playlist.name || '',
    version: playlist.version || 0,
    color: playlist.color || '#3b82f6',
    created_at: playlist.created_at || '',
    updated_at: playlist.updated_at || '',
    items: typedItems,
    summary: summaryPayload,
    assignedDevices,
  }
}

export async function updatePlaylistName(
  playlistId: string,
  name: string,
  teamSlug: string
) {
  const supabase = await createClient()
  const { user, teamId } = await getAuthenticatedTeamId(supabase)
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'updatePlaylistName', 30, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Playlist name is required.')
  if (trimmedName.length > 200) throw new Error('Playlist name is too long.')

  const { error } = await supabase
    .from('playlists')
    .update({ name: trimmedName })
    .eq('id', playlistId)
    .eq('team_id', teamId)

  if (error) throw new Error('Failed to rename playlist.')

  revalidatePath(`/customer/${teamSlug}/playlists`)
  revalidatePath(`/customer/${teamSlug}/playlists/${playlistId}`)
}

export async function duplicatePlaylist(
  playlistId: string,
  teamSlug: string
): Promise<{ id: string }> {
  const supabase = await createClient()
  const { user, teamId } = await getAuthenticatedTeamId(supabase)
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'duplicatePlaylist', 10, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  // Fetch original playlist
  const { data: original, error: fetchError } = await supabase
    .from('playlists')
    .select('name')
    .eq('id', playlistId)
    .eq('team_id', teamId)
    .single()

  if (fetchError || !original) {
    throw new Error('Playlist not found.')
  }

  // Fetch original items
  const { data: originalItems, error: itemsError } = await supabase
    .from('playlist_items')
    .select('type, asset_id, duration_seconds, widget_type, widget_config, sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    throw new Error('Failed to read playlist items.')
  }

  // Create duplicate via atomic RPC
  const itemsJson = (originalItems || []).map((item, index) => ({
    type: item.type,
    asset_id: item.asset_id || null,
    duration_seconds: item.duration_seconds,
    sort_order: index,
    widget_type: item.widget_type || null,
    widget_config: (item.widget_config || null) as Json,
  }))

  const { data, error: rpcError } = await supabase.rpc('create_playlist_atomic', {
    p_team_id: teamId,
    p_name: `${original.name} (Copy)`,
    p_items: itemsJson,
  })

  if (rpcError) {
    console.error('[duplicatePlaylist] RPC error:', rpcError)
    throw new Error('Failed to duplicate playlist.')
  }

  const result = data as unknown as { success: boolean; id?: string; error?: string }
  if (!result.success) {
    throw new Error(result.error || 'Failed to duplicate playlist.')
  }

  revalidatePath(`/customer/${teamSlug}/playlists`)
  return { id: result.id! }
}

export async function pushPlaylistToScreens(
  playlistId: string,
  deviceIds: string[],
  teamSlug: string
) {
  const supabase = await createClient()
  const { user, teamId } = await getAuthenticatedTeamId(supabase)
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'pushPlaylistToScreens', 20, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  if (!deviceIds.length) throw new Error('No screens selected.')
  if (deviceIds.length > 100) throw new Error('Too many screens selected.')

  // Validate playlist belongs to team
  const { data: playlist, error: plError } = await supabase
    .from('playlists')
    .select('id, name')
    .eq('id', playlistId)
    .eq('team_id', teamId)
    .single()

  if (plError || !playlist) {
    throw new Error('Playlist not found.')
  }

  // Validate devices belong to team
  const { data: devices, error: devError } = await supabase
    .from('devices')
    .select('id')
    .in('id', deviceIds)
    .eq('team_id', teamId)

  if (devError || !devices || devices.length === 0) {
    throw new Error('No valid screens found.')
  }

  const validIds = devices.map(d => d.id)

  // Update all devices
  const { error: updateError } = await supabase
    .from('devices')
    .update({
      content_type: 'Playlist',
      playlist_id: playlistId,
      asset_id: null,
      content: null,
    })
    .in('id', validIds)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[pushPlaylistToScreens] update error:', updateError)
    throw new Error('Failed to push playlist to screens.')
  }

  // Activity log
  try {
    const logEntries = validIds.map(devId => ({
      team_id: teamId,
      device_id: devId,
      event_type: 'content_assignment',
      description: `Assigned Playlist: ${playlist.name}`,
      metadata: {
        content_type: 'Playlist',
        playlist_id: playlistId,
      }
    }))
    await supabase.from('activity_log').insert(logEntries)
  } catch (err) {
    console.error('[pushPlaylistToScreens] Activity logging failed:', err)
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/playlists/${playlistId}`)
  return { count: validIds.length }
}

export async function getAssignableDevices() {
  const supabase = await createClient()
  const { teamId } = await getAuthenticatedTeamId(supabase)

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id, name, status, content_type, playlist_id, asset_id')
    .eq('team_id', teamId)
    .neq('status', 'pairing')
    .order('name', { ascending: true })

  if (error) throw new Error('Failed to load screens.')

  return devices || []
}
