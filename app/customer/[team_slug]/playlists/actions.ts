'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPlaylist(teamId: string, name: string, teamSlug: string, items: any[]) {
  const supabase = await createClient()

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .insert({ team_id: teamId, name })
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
      widget_config: item.widget_config || null
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

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)

  if (error) throw new Error(error.message)

  revalidatePath(`/customer/${teamSlug}/playlists`)
}

export async function getPlaylistItems(playlistId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('playlist_items')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })
    
  if (error) throw new Error(error.message)
  return data || []
}

export async function updatePlaylist(playlistId: string, name: string, teamSlug: string, items: any[]) {
  const supabase = await createClient()

  // 1. Delete existing items
  const { error: deleteError } = await supabase
    .from('playlist_items')
    .delete()
    .eq('playlist_id', playlistId)

  if (deleteError) throw new Error(deleteError.message)

  // 2. Insert new items
  if (items.length > 0) {
    const itemsToInsert = items.map((item, index) => ({
      playlist_id: playlistId,
      type: item.type,
      asset_id: item.asset_id || null,
      duration_seconds: item.duration_seconds,
      sort_order: index,
      widget_type: item.widget_type || null,
      widget_config: item.widget_config || null
    }))

    const { error: itemsError } = await supabase
      .from('playlist_items')
      .insert(itemsToInsert)

    if (itemsError) throw new Error(itemsError.message)
  }

  // 3. Update playlist name (Triggers realtime update to players)
  const { error: updateError } = await supabase
    .from('playlists')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', playlistId)

  if (updateError) throw new Error(updateError.message)

  revalidatePath(`/customer/${teamSlug}/playlists`)
}
