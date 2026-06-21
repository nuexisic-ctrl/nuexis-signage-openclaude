'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimitAction } from '@/lib/redis'

export interface GroupActionResult {
  success: boolean
  error?: string
  groupId?: string
}

async function broadcastContentUpdateToDevices(supabase: any, deviceIds: string[]) {
  if (!deviceIds || deviceIds.length === 0) return
  for (const devId of deviceIds) {
    const channel = supabase.channel(`device-pair-${devId}`)
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'content_update',
          payload: { timestamp: Date.now() }
        }).catch(console.error)
        setTimeout(() => supabase.removeChannel(channel), 1000)
      }
    })
  }
}

export async function createGroup(
  teamSlug: string,
  name: string,
  color: string
): Promise<GroupActionResult> {
  let finalName = name.trim()
  if (!finalName) {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    finalName = `Group - ${dateStr} ${timeStr}`
  }

  if (finalName.length < 1 || finalName.length > 60) {
    return { success: false, error: 'Group name must be between 1 and 60 characters.' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to create a group.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'createGroup', 20, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { data: newGroup, error: insertError } = await supabase
    .from('screen_groups')
    .insert({
      team_id: teamId,
      name: finalName,
      color: color || '#3b82f6',
      created_by: user.id
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createGroup] Insert error:', insertError)
    if (insertError.code === '23505') {
      return { success: false, error: 'A group with this name already exists in your workspace.' }
    }
    return { success: false, error: 'Failed to create group. Please try again.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true, groupId: newGroup?.id }
}

export async function renameGroup(
  teamSlug: string,
  groupId: string,
  name: string
): Promise<GroupActionResult> {
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 60) {
    return { success: false, error: 'Group name must be between 1 and 60 characters.' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to rename a group.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'renameGroup', 20, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { error: updateError } = await supabase
    .from('screen_groups')
    .update({ name: trimmedName })
    .eq('id', groupId)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[renameGroup] Update error:', updateError)
    if (updateError.code === '23505') {
      return { success: false, error: 'A group with this name already exists in your workspace.' }
    }
    return { success: false, error: 'Failed to rename group.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export async function deleteGroup(
  teamSlug: string,
  groupId: string
): Promise<GroupActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to delete a group.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'deleteGroup', 15, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { error: deleteError } = await supabase
    .from('screen_groups')
    .delete()
    .eq('id', groupId)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[deleteGroup] Delete error:', deleteError)
    return { success: false, error: 'Failed to delete group.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export interface GroupAssignmentData {
  content_type: 'Asset' | 'Playlist' | null
  asset_id: string | null
  playlist_id: string | null
  orientation: 0 | 90 | 180 | 270
}

export async function assignContentToGroup(
  teamSlug: string,
  groupId: string,
  data: GroupAssignmentData
): Promise<GroupActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to update a group.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'assignContentToGroup', 30, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { error: updateError } = await supabase
    .from('screen_groups')
    .update({
      content_type: data.content_type,
      asset_id: data.asset_id,
      playlist_id: data.playlist_id,
      orientation: data.orientation
    })
    .eq('id', groupId)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[assignContentToGroup] Update error:', updateError)
    return { success: false, error: 'Failed to update group content.' }
  }

  // Touch all member devices to trigger their realtime subscriptions so they fetch
  // their resolved device state from the DB (which dynamically resolves group content).
  const { data: members } = await supabase
    .from('screen_group_members')
    .select('device_id')
    .eq('group_id', groupId)
    .eq('team_id', teamId)

  if (members && members.length > 0) {
    const deviceIds = members.map(m => m.device_id)
    const { error: pushError } = await supabase
      .from('devices')
      .update({
        updated_at: new Date().toISOString(),
      })
      .in('id', deviceIds)
      .eq('team_id', teamId)

    if (pushError) {
      console.error('[assignContentToGroup] Touch member devices error:', pushError)
    }

    // Broadcast realtime content_update
    await broadcastContentUpdateToDevices(supabase, deviceIds)
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export async function updateGroupMembers(
  teamSlug: string,
  groupId: string,
  deviceIds: string[]
): Promise<GroupActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to update group members.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'updateGroupMembers', 20, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  // 1. Fetch existing member device IDs to notify them
  const { data: oldMembers } = await supabase
    .from('screen_group_members')
    .select('device_id')
    .eq('group_id', groupId)
    .eq('team_id', teamId)
  const oldDeviceIds = oldMembers?.map(m => m.device_id) || []

  // 2. Delete all existing member assignments for this group
  const { error: deleteError } = await supabase
    .from('screen_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[updateGroupMembers] Delete existing error:', deleteError)
    return { success: false, error: 'Failed to update group members.' }
  }

  // 2. If new device IDs are specified, insert them
  if (deviceIds.length > 0) {
    // Validate that all devices belong to the current team
    const { data: devices, error: checkError } = await supabase
      .from('devices')
      .select('id')
      .in('id', deviceIds)
      .eq('team_id', teamId)

    if (checkError) {
      console.error('[updateGroupMembers] Validate devices error:', checkError)
      return { success: false, error: 'Failed to validate screens.' }
    }

    const validatedIds = devices?.map(d => d.id) || []
    if (validatedIds.length !== deviceIds.length) {
      return { success: false, error: 'One or more screens do not belong to your team.' }
    }

    const insertRows = validatedIds.map(id => ({
      group_id: groupId,
      device_id: id,
      team_id: teamId,
      is_primary: true // default new members to true
    }))

    const { error: insertError } = await supabase
      .from('screen_group_members')
      .insert(insertRows)

    if (insertError) {
      console.error('[updateGroupMembers] Insert error:', insertError)
      return { success: false, error: 'Failed to add members to group.' }
    }
  }

  // Broadcast realtime content_update to all old and new members
  const allImpactedIds = Array.from(new Set([...oldDeviceIds, ...deviceIds]))
  await broadcastContentUpdateToDevices(supabase, allImpactedIds)

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export async function addDevicesToGroup(
  teamSlug: string,
  groupId: string,
  deviceIds: string[]
): Promise<GroupActionResult> {
  if (deviceIds.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to update groups.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'addDevicesToGroup', 20, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  // Verify devices
  const { data: devices, error: checkError } = await supabase
    .from('devices')
    .select('id')
    .in('id', deviceIds)
    .eq('team_id', teamId)

  if (checkError) {
    return { success: false, error: 'Failed to validate screens.' }
  }

  const validatedIds = devices?.map(d => d.id) || []
  const insertRows = validatedIds.map(id => ({
    group_id: groupId,
    device_id: id,
    team_id: teamId,
    is_primary: true
  }))

  const { error: insertError } = await supabase
    .from('screen_group_members')
    .upsert(insertRows, { onConflict: 'group_id,device_id' })

  if (insertError) {
    console.error('[addDevicesToGroup] Upsert error:', insertError)
    return { success: false, error: 'Failed to add screens to group.' }
  }

  // Broadcast realtime content_update
  await broadcastContentUpdateToDevices(supabase, validatedIds)

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export async function removeDevicesFromGroup(
  teamSlug: string,
  groupId: string,
  deviceIds: string[]
): Promise<GroupActionResult> {
  if (deviceIds.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'removeDevicesFromGroup', 20, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const { error: deleteError } = await supabase
    .from('screen_group_members')
    .delete()
    .eq('group_id', groupId)
    .in('device_id', deviceIds)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[removeDevicesFromGroup] Delete error:', deleteError)
    return { success: false, error: 'Failed to remove screens from group.' }
  }

  // Broadcast realtime content_update
  await broadcastContentUpdateToDevices(supabase, deviceIds)

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

export async function saveGroupChanges(
  teamSlug: string,
  groupId: string,
  data: {
    name: string
    color: string
    content_type: 'Asset' | 'Playlist' | null
    asset_id: string | null
    playlist_id: string | null
    orientation: 0 | 90 | 180 | 270
    scale_mode?: 'None' | 'Fit' | 'Stretch' | 'Zoom' | null
    deviceIds: string[]
  }
): Promise<GroupActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to update a group.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!(await rateLimitAction(user.id, 'saveGroupChanges', 30, 60))) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  // 1. Update group properties
  const { error: groupUpdateError } = await supabase
    .from('screen_groups')
    .update({
      name: data.name.trim(),
      color: data.color,
      content_type: data.content_type,
      asset_id: data.content_type === 'Asset' ? data.asset_id : null,
      playlist_id: data.content_type === 'Playlist' ? data.playlist_id : null,
      orientation: data.orientation
    })
    .eq('id', groupId)
    .eq('team_id', teamId)

  if (groupUpdateError) {
    console.error('[saveGroupChanges] Group update error:', groupUpdateError)
    return { success: false, error: 'Failed to update group settings.' }
  }

  // 2. Sync members
  const { error: deleteError } = await supabase
    .from('screen_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('team_id', teamId)

  if (deleteError) {
    console.error('[saveGroupChanges] Delete members error:', deleteError)
    return { success: false, error: 'Failed to update group screens.' }
  }

  if (data.deviceIds.length > 0) {
    const insertRows = data.deviceIds.map(id => ({
      group_id: groupId,
      device_id: id,
      team_id: teamId,
      is_primary: true
    }))
    const { error: insertError } = await supabase
      .from('screen_group_members')
      .insert(insertRows)

    if (insertError) {
      console.error('[saveGroupChanges] Insert members error:', insertError)
      return { success: false, error: 'Failed to add screens to group.' }
    }
  }

  // 3. Update all screens in the group in the devices table
  if (data.deviceIds.length > 0) {
    const { error: devicesUpdateError } = await supabase
      .from('devices')
      .update({
        content_type: data.content_type,
        asset_id: data.content_type === 'Asset' ? data.asset_id : null,
        playlist_id: data.content_type === 'Playlist' ? data.playlist_id : null,
        orientation: data.orientation,
        scale_mode: data.scale_mode,
        updated_at: new Date().toISOString() // Touch to trigger realtime sync
      })
      .in('id', data.deviceIds)
      .eq('team_id', teamId)

    if (devicesUpdateError) {
      console.error('[saveGroupChanges] Devices update error:', devicesUpdateError)
      return { success: false, error: 'Failed to apply settings to member screens.' }
    }

    // Broadcast realtime content_update
    await broadcastContentUpdateToDevices(supabase, data.deviceIds)
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/groups`)
  return { success: true }
}

