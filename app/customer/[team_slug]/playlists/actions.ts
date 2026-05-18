'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimitAction } from '@/lib/redis'

// ── Auth helper ─────────────────────────────────────────────────────────
// Verifies the caller is authenticated and returns their verified team_id
// from JWT app_metadata — never trusting client-supplied values.
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

// ── Playlist item type for server-side validation ───────────────────────
interface PlaylistItemInput {
  type: string
  asset_id?: string | null
  duration_seconds: number
  widget_type?: string | null
  widget_config?: unknown
}

export async function createPlaylist(
  _teamId: string, // kept for API compat, but IGNORED — we use the JWT value
  name: string,
  teamSlug: string,
  items: PlaylistItemInput[]
) {
  const supabase = await createClient()
  const { user, teamId } = await getAuthenticatedTeamId(supabase)
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'createPlaylist', 20, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  // Input validation
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Playlist name is required.')

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .insert({ team_id: teamId, name: trimmedName })
    .select('id')
    .single()

  if (playlistError) throw new Error(playlistError.message)

  if (items.length > 0) {
    const itemsToInsert = items.map((item, index) => ({
      playlist_id: playlist.id,
      type: item.type,
      asset_id: item.asset_id || null,
      duration_seconds: item.duration_seconds,
      sort_order: index,
      widget_type: item.widget_type || null,
      widget_config: (item.widget_config || null) as import('@/types/supabase').Json
    }))

    const { error: itemsError } = await supabase
      .from('playlist_items')
      .insert(itemsToInsert)

    if (itemsError) throw new Error(itemsError.message)
  }

  revalidatePath(`/customer/${teamSlug}/playlists`)
  return playlist
}

export async function deletePlaylist(playlistId: string, teamSlug: string) {
  const supabase = await createClient()
  const { user } = await getAuthenticatedTeamId(supabase) // verifies auth — RLS enforces team scope
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'deletePlaylist', 20, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)

  if (error) throw new Error(error.message)

  revalidatePath(`/customer/${teamSlug}/playlists`)
}

export async function getPlaylistItems(playlistId: string) {
  const supabase = await createClient()
  await getAuthenticatedTeamId(supabase) // verifies auth — RLS enforces team scope

  const { data, error } = await supabase
    .from('playlist_items')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updatePlaylist(
  playlistId: string,
  name: string,
  teamSlug: string,
  items: PlaylistItemInput[]
) {
  const supabase = await createClient()
  const { user, teamId } = await getAuthenticatedTeamId(supabase)
  await requireOwner(supabase, user.id)

  if (!(await rateLimitAction(user.id, 'updatePlaylist', 30, 60))) {
    throw new Error('Too many requests. Please try again later.')
  }

  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Playlist name is required.')

  // Use the SECURITY DEFINER RPC — runs delete/insert/update in a
  // single Postgres transaction. If any step fails, ALL changes roll back.
  const itemsJson = items.map((item, index) => ({
    type: item.type,
    asset_id: item.asset_id || null,
    duration_seconds: item.duration_seconds,
    sort_order: index,
    widget_type: item.widget_type || null,
    widget_config: item.widget_config || null
  }))

  const { data, error: rpcError } = await supabase.rpc('update_playlist_atomic', {
    p_playlist_id: playlistId,
    p_name: trimmedName,
    p_team_id: teamId,
    p_items: JSON.stringify(itemsJson), // jsonb parameter
  })

  if (rpcError) {
    console.error('[updatePlaylist] RPC error:', rpcError)
    throw new Error('Failed to update playlist. Please try again.')
  }

  const result = data as unknown as { success: boolean; error?: string }
  if (!result.success) {
    throw new Error(result.error || 'Failed to update playlist.')
  }

  revalidatePath(`/customer/${teamSlug}/playlists`)
}
