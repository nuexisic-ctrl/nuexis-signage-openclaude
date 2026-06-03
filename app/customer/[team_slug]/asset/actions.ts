'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sanitize from 'sanitize-filename'
import { redis } from '@/lib/redis'
import DOMPurify from 'isomorphic-dompurify'

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

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  if (!asset.mime_type.startsWith('application/x-widget') && !asset.file_path.startsWith(`${teamId}/`)) {
    return { success: false, error: 'Invalid file path.' }
  }

  if (asset.mime_type === 'application/x-widget-remote-url') {
    try {
      const parsed = new URL(asset.file_path)
      if (parsed.protocol !== 'https:') {
        return { success: false, error: 'Remote URLs must use HTTPS for security.' }
      }
    } catch {
      return { success: false, error: 'Invalid URL.' }
    }
  }

  if (asset.mime_type === 'application/x-widget-html') {
    try {
      const { html = '', css = '' } = JSON.parse(asset.file_path)
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
          'br', 'img', 'a', 'strong', 'em', 'b', 'i', 'u', 'table', 'thead', 'tbody',
          'tr', 'th', 'td', 'style'
        ],
        ALLOWED_ATTR: ['class', 'style', 'src', 'href', 'target', 'alt', 'width', 'height']
      })
      asset.file_path = JSON.stringify({ html: sanitizedHtml, css })
    } catch (err) {
      return { success: false, error: 'Invalid HTML widget data.' }
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
  fileName: string,
  sizeBytes: number
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

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  // 1. Validate file size (max 50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (sizeBytes > MAX_FILE_SIZE) {
    return { success: false, error: 'File size exceeds the 50MB limit.' }
  }

  // 2. Validate file type
  const safeFileName = sanitize(fileName)
  if (!safeFileName.match(/\.(png|jpg|jpeg|mp4|webm|pdf)$/i)) {
    return { success: false, error: 'Invalid file type. Only PNG, JPG, MP4, WEBM, and PDF are allowed.' }
  }

  // 3. Rate Limit & Storage Quota
  try {
    if (redis) {
      const uploadCountKey = `upload_count:${teamId}`
      const uploadsCount = await redis.incr(uploadCountKey)
      if (uploadsCount === 1) {
        await redis.expire(uploadCountKey, 3600) // 1 hour window
      }
      if (uploadsCount > 100) { // Max 100 uploads per hour
        return { success: false, error: 'Upload rate limit exceeded. Try again later.' }
      }
    }
  } catch (err) {
    console.error('[getUploadUrl] Rate limiting error:', err)
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

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
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

  try {
    await requireOwner(supabase, user.id)
  } catch (err: any) {
    return { success: false, error: err.message }
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

export async function pushWidgetToScreen(
  teamSlug: string,
  deviceId: string,
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to assign to a screen.' }
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

  const { error: updateError } = await supabase
    .from('devices')
    .update({
      content_type: 'Asset',
      asset_id: assetId,
      playlist_id: null,
    })
    .eq('id', deviceId)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[pushWidgetToScreen] error:', updateError)
    return { success: false, error: 'Failed to assign widget to screen.' }
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

export async function deleteAssetsBulk(
  teamSlug: string,
  assetsToDelete: { id: string; filePath: string }[]
): Promise<DeleteAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
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

  const assetIds = assetsToDelete.map(a => a.id)

  // 1. Verify ownership of all assets
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, team_id, file_path, mime_type')
    .in('id', assetIds)

  if (assetsError || !assets || assets.length === 0) {
    return { success: false, error: 'Assets not found.' }
  }

  // Double check that every asset belongs to the caller's team
  const unauthorized = assets.some(a => a.team_id !== teamId)
  if (unauthorized) {
    return { success: false, error: 'You do not have permission to delete these assets.' }
  }

  // 2. Remove files from storage
  const storageFiles = assets
    .filter(a => !a.mime_type.startsWith('application/x-widget'))
    .map(a => a.file_path)

  if (storageFiles.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('workspace-media')
      .remove(storageFiles)

    if (storageError) {
      console.error('[deleteAssetsBulk] storage error:', storageError)
      return { success: false, error: 'An unexpected error occurred while deleting assets from storage.' }
    }
  }

  // 3. Delete records from DB
  const { error: dbError } = await supabase
    .from('assets')
    .delete()
    .in('id', assetIds)
    .eq('team_id', teamId)

  if (dbError) {
    console.error('[deleteAssetsBulk] db error:', { message: dbError.message, details: dbError.details, hint: dbError.hint })
    return { success: false, error: 'An unexpected error occurred while removing asset database records.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

export async function createFolder(
  teamSlug: string,
  folderName: string,
  color: string
): Promise<InsertAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to create folders.' }
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

  const { data, error } = await supabase
    .from('assets')
    .insert({
      team_id: teamId,
      file_name: folderName.trim(),
      file_path: 'folder',
      mime_type: 'application/x-folder',
      size_bytes: 0,
      color: color,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createFolder] error:', error)
    return { success: false, error: 'An unexpected error occurred while creating your folder.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true, id: data.id }
}

export async function updateAssetFolder(
  teamSlug: string,
  assetId: string,
  newName: string,
  color: string
): Promise<InsertAssetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to rename a folder.' }
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

  const { data: updated, error: updateError } = await supabase
    .from('assets')
    .update({ file_name: newName.trim(), color: color })
    .eq('id', assetId)
    .eq('team_id', teamId)
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[updateAssetFolder] update error:', updateError)
    return { success: false, error: 'Failed to update folder. Please try again later.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true, id: assetId }
}

export async function moveAssetsToFolder(
  teamSlug: string,
  assetIds: string[],
  folderId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
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

  // 1. Verify ownership of all target assets
  const { data: targetAssets, error: selectError } = await supabase
    .from('assets')
    .select('id, team_id')
    .in('id', assetIds)

  if (selectError || !targetAssets || targetAssets.length === 0) {
    return { success: false, error: 'Assets not found.' }
  }

  const unauthorized = targetAssets.some(a => a.team_id !== teamId)
  if (unauthorized) {
    return { success: false, error: 'You do not have permission to modify these assets.' }
  }

  // 2. If a folderId is provided, check that the folder also exists and belongs to this team
  if (folderId) {
    const { data: folderAsset, error: folderError } = await supabase
      .from('assets')
      .select('id, team_id, mime_type')
      .eq('id', folderId)
      .single()

    if (folderError || !folderAsset || folderAsset.team_id !== teamId || folderAsset.mime_type !== 'application/x-folder') {
      return { success: false, error: 'Target folder not found.' }
    }
  }

  const { error: updateError } = await supabase
    .from('assets')
    .update({ folder_id: folderId })
    .in('id', assetIds)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[moveAssetsToFolder] error:', updateError)
    return { success: false, error: 'Failed to move assets to folder.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

