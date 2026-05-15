'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sanitize from 'sanitize-filename'

export type InsertAssetResult =
  | { success: true; id: string }
  | { success: false; error: string }

export interface AssetInput {
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
}

export async function insertAsset(
  teamSlug: string,
  asset: AssetInput
): Promise<InsertAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to upload assets.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  if (!asset.mime_type.startsWith('application/x-widget') && !asset.file_path.startsWith(`${teamId}/`)) {
    return { success: false, error: 'Invalid file path.' }
  }

  if (asset.mime_type === 'application/x-widget-remote-url') {
    try {
      const parsed = new URL(asset.file_path)
      if (parsed.protocol !== 'https:') {
        return { success: false, error: 'URL must use HTTPS protocol.' }
      }
      const pathname = parsed.pathname.toLowerCase()
      if (!/\.(mp4|webm|jpg|jpeg|png)$/.test(pathname)) {
        return { success: false, error: 'URL must end with .mp4, .webm, .jpg, .jpeg, or .png' }
      }
    } catch {
      return { success: false, error: 'Invalid URL.' }
    }
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      team_id: teamId,
      file_name: asset.file_name,
      file_path: asset.file_path,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[insertAsset] error:', { message: error.message, details: error.details, hint: error.hint })
    return { success: false, error: 'An unexpected error occurred while managing your media.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true, id: data.id }
}

export type GetUploadUrlResult =
  | { success: true; signedUrl: string; token: string; path: string }
  | { success: false; error: string }

export async function getUploadUrl(
  teamSlug: string,
  fileName: string
): Promise<GetUploadUrlResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to upload assets.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  const safeFileName = sanitize(fileName)
  if (!safeFileName.match(/\.(png|jpg|jpeg|mp4|webm|pdf)$/i)) {
    return { success: false, error: 'Invalid file type. Only PNG, JPG, MP4, WEBM, and PDF are allowed.' }
  }

  const path = `${teamId}/${Date.now()}-${safeFileName}`

  const { data, error } = await supabase.storage
    .from('workspace-media')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[getUploadUrl] error:', error ? { message: error.message, name: error.name } : 'No data returned')
    return { success: false, error: 'An unexpected error occurred while managing your media.' }
  }

  return {
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path
  }
}

export type DeleteAssetResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteAsset(
  teamSlug: string,
  assetId: string,
  filePath: string
): Promise<DeleteAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
  }

  // ── Resolve caller's team ──────────────────────────────────────────────────
  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // ── Verify ownership before touching anything ──────────────────────────────
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, team_id, file_path, mime_type')
    .eq('id', assetId)
    .single()

  if (assetError || !asset) {
    return { success: false, error: 'Asset not found.' }
  }

  if (asset.team_id !== teamId) {
    console.warn(
      `[deleteAsset] Unauthorized: user ${user.id} (team ${teamId}) ` +
      `attempted to delete asset ${assetId} (team ${asset.team_id})`
    )
    return { success: false, error: 'You do not have permission to delete this asset.' }
  }

  // Sanity-check: filePath the client sent must match the DB record
  if (asset.file_path !== filePath) {
    console.warn(`[deleteAsset] filePath mismatch for asset ${assetId}`)
    return { success: false, error: 'Invalid file path.' }
  }

  // ── Delete from storage ────────────────────────────────────────────────────
  if (!asset.mime_type.startsWith('application/x-widget')) {
    const { error: storageError } = await supabase.storage
      .from('workspace-media')
      .remove([filePath])

    if (storageError) {
      console.error('[deleteAsset] storage error:', storageError)
      return { success: false, error: 'An unexpected error occurred while managing your media.' }
    }
  }

  // ── Delete from database (double-lock: ownership filter + RLS) ────────────
  const { error: dbError } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('team_id', teamId)

  if (dbError) {
    console.error('[deleteAsset] db error:', { message: dbError.message, details: dbError.details, hint: dbError.hint })
    return { success: false, error: 'An unexpected error occurred while managing your media.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

export async function updateAssetName(
  teamSlug: string,
  assetId: string,
  newName: string
): Promise<InsertAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to rename an asset.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined

  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('assets')
    .update({ file_name: newName.trim() })
    .eq('id', assetId)
    .eq('team_id', teamId)
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[updateAssetName] update error:', updateError ? { message: updateError.message, details: updateError.details, hint: updateError.hint } : 'No rows updated')
    return { success: false, error: 'Failed to rename asset. Please try again later.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true, id: assetId }
}
