'use server'

import { createClient, requireOwner } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sanitize from 'sanitize-filename'
import { redis } from '@/lib/redis'
import DOMPurify from 'isomorphic-dompurify'
import dns from 'dns'
import net from 'net'
import { promisify } from 'util'

export type InsertAssetResult =
  | { success: true; id: string }
  | { success: false; error: string }

export interface AssetInput {
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  folder_id?: string | null
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

  const trimmedName = asset.file_name.trim()
  if (!trimmedName || trimmedName.length > 100) {
    return { success: false, error: 'Asset name must be between 1 and 100 characters.' }
  }
  asset.file_name = trimmedName

  // Check duplicate name within the same folder for this team (case-insensitive check in DB)
  let duplicateQuery = supabase
    .from('assets')
    .select('id')
    .eq('team_id', teamId)
    .ilike('file_name', trimmedName)

  if (asset.folder_id) {
    duplicateQuery = duplicateQuery.eq('folder_id', asset.folder_id)
  } else {
    duplicateQuery = duplicateQuery.is('folder_id', null)
  }

  const { data: duplicateName, error: duplicateError } = await duplicateQuery
  if (duplicateError) {
    console.error('[insertAsset] Name duplicate check error:', duplicateError)
  }
  if (duplicateName && duplicateName.length > 0) {
    return { success: false, error: 'An asset or widget with this name already exists in this folder.' }
  }

  if (asset.mime_type === 'application/x-widget-website') {
    if (typeof asset.file_path !== 'string') {
      return { success: false, error: 'Invalid Website URL.' }
    }
    let normalized = asset.file_path.trim()
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized
    }
    try {
      new URL(normalized)
    } catch {
      return { success: false, error: 'Invalid URL format.' }
    }
    asset.file_path = normalized
  }

  if (asset.mime_type === 'application/x-widget-worldclock') {
    try {
      const config = JSON.parse(asset.file_path)
      if (config.clockType !== 'analog' && config.clockType !== 'digital') {
        return { success: false, error: 'Invalid clock type.' }
      }
      if (typeof config.timezone !== 'string' || config.timezone.trim().length === 0 || config.timezone.length > 100) {
        return { success: false, error: 'Invalid timezone.' }
      }
      if (config.theme !== 'light' && config.theme !== 'dark' && config.theme !== 'custom') {
        return { success: false, error: 'Invalid theme option.' }
      }
      if (config.themeSettings) {
        const hexRegex = /^#([0-9a-fA-F]{3}){1,2}$/
        if (config.themeSettings.backgroundColor && !hexRegex.test(config.themeSettings.backgroundColor)) {
          return { success: false, error: 'Invalid background color format.' }
        }
        if (config.themeSettings.textColor && !hexRegex.test(config.themeSettings.textColor)) {
          return { success: false, error: 'Invalid text color format.' }
        }
      }
    } catch {
      return { success: false, error: 'Invalid widget configuration.' }
    }
  }

  if (asset.mime_type === 'application/x-widget-countup' || asset.mime_type === 'application/x-widget-countdown') {
    try {
      const config = JSON.parse(asset.file_path)
      if (typeof config.text !== 'string' || config.text.trim().length === 0 || config.text.length > 150) {
        return { success: false, error: 'Heading text is invalid or exceeds 150 characters.' }
      }
      if (config.endMessage && (typeof config.endMessage !== 'string' || config.endMessage.length > 200)) {
        return { success: false, error: 'End message exceeds 200 characters.' }
      }
      if (config.themeSettings) {
        const hexRegex = /^#([0-9a-fA-F]{3}){1,2}$/
        if (config.themeSettings.primaryColor && !hexRegex.test(config.themeSettings.primaryColor)) {
          return { success: false, error: 'Invalid primary color format.' }
        }
        if (config.themeSettings.secondaryColor && !hexRegex.test(config.themeSettings.secondaryColor)) {
          return { success: false, error: 'Invalid secondary color format.' }
        }
        if (config.themeSettings.textColor && !hexRegex.test(config.themeSettings.textColor)) {
          return { success: false, error: 'Invalid text color format.' }
        }
        const bg = config.themeSettings.backgroundColor
        if (bg && !hexRegex.test(bg) && !bg.startsWith('linear-gradient')) {
          return { success: false, error: 'Invalid background color format.' }
        }
        if (config.themeSettings.backgroundImage) {
          try {
            const parsed = new URL(config.themeSettings.backgroundImage)
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
              return { success: false, error: 'Background image URL must use HTTP or HTTPS.' }
            }
          } catch {
            return { success: false, error: 'Invalid background image URL.' }
          }
        }
      }
    } catch {
      return { success: false, error: 'Invalid widget configuration.' }
    }
  }

  if (asset.mime_type === 'application/x-widget-youtube') {
    if (typeof asset.file_path !== 'string' || (!asset.file_path.includes('youtube.com') && !asset.file_path.includes('youtu.be'))) {
      return { success: false, error: 'Invalid YouTube URL.' }
    }
  }

  if (asset.mime_type === 'application/x-widget-qrcode') {
    try {
      const config = JSON.parse(asset.file_path)
      if (typeof config.url !== 'string' || config.url.trim().length === 0 || config.url.length > 2000) {
        return { success: false, error: 'Invalid QR Code URL or URL exceeds 2000 characters.' }
      }
    } catch {
      return { success: false, error: 'Invalid QR Code configuration.' }
    }
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
      folder_id: asset.folder_id || null,
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

  const trimmedName = newName.trim()
  if (!trimmedName || trimmedName.length > 100) {
    return { success: false, error: 'Asset name must be between 1 and 100 characters.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('assets')
    .update({ file_name: trimmedName })
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

function getAssetContentUrl(asset: { id: string; file_path: string; mime_type: string }) {
  if (asset.mime_type === 'application/x-widget-remote-url') {
    return asset.file_path
  }

  if (asset.mime_type.startsWith('application/x-widget')) {
    return asset.file_path
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const encodedPath = asset.file_path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  return `${baseUrl}/storage/v1/object/public/workspace-media/${encodedPath}`
}

export async function pushAssetToScreen(
  teamSlug: string,
  deviceId: string,
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to push assets to a screen.' }
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

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, team_id, file_path, mime_type')
    .eq('id', assetId)
    .single()

  if (assetError || !asset || asset.team_id !== teamId) {
    return { success: false, error: 'Asset not found.' }
  }

  if (asset.mime_type === 'application/x-folder') {
    return { success: false, error: 'Folders cannot be pushed to screens.' }
  }

  const content = getAssetContentUrl(asset)

  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({
      content_type: 'Asset',
      content,
      asset_id: assetId,
      playlist_id: null,
    })
    .eq('id', deviceId)
    .eq('team_id', teamId)
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    console.error('[pushAssetToScreen] update error:', updateError ? { message: updateError.message, details: updateError.details, hint: updateError.hint } : 'No rows updated')
    return { success: false, error: 'Failed to push asset to screen. Please try again later.' }
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
  color: string,
  parentFolderId?: string | null
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

  const trimmedName = folderName.trim()
  if (!trimmedName || trimmedName.length > 100) {
    return { success: false, error: 'Folder name must be between 1 and 100 characters.' }
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      team_id: teamId,
      file_name: trimmedName,
      file_path: 'folder',
      mime_type: 'application/x-folder',
      size_bytes: 0,
      color: color,
      folder_id: parentFolderId || null,
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

  const trimmedName = newName.trim()
  if (!trimmedName || trimmedName.length > 100) {
    return { success: false, error: 'Folder name must be between 1 and 100 characters.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('assets')
    .update({ file_name: trimmedName, color: color })
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

  if (!assetIds || assetIds.length === 0) {
    return { success: true }
  }

  // 1. Verify ownership of all target assets and fetch their current folder_id
  const { data: targetAssets, error: selectError } = await supabase
    .from('assets')
    .select('id, team_id, folder_id')
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

  // 3. Prevent redundant moves:
  //    - treat root as folder_id IS NULL
  //    - treat destination folder_id as an exact match
  const allTargetIds = new Set(targetAssets.map(a => a.id))

  const idsAlreadyInDestination = new Set(
    targetAssets
      .filter(a => {
        if (folderId === null) return a.folder_id === null
        return a.folder_id === folderId
      })
      .map(a => a.id)
  )

  // Assets that actually need updating.
  const idsActuallyToMove: string[] = Array.from(allTargetIds).filter(
    id => !idsAlreadyInDestination.has(id)
  )

  if (idsActuallyToMove.length === 0) {
    return { success: true }
  }

  const { error: updateError } = await supabase
    .from('assets')
    .update({ folder_id: folderId })
    .in('id', idsActuallyToMove)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[moveAssetsToFolder] error:', updateError)
    return { success: false, error: 'Failed to move assets to folder.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

export type UpdateWidgetResult =
  | { success: true }
  | { success: false; error: string }

/**
 * updateWidgetAsset
 * Updates an existing widget asset's name and configuration in-place.
 * After updating the asset, it also refreshes the `content` column on every
 * device that currently has this widget assigned — this triggers the player's
 * existing Supabase Realtime subscription so all screens update instantly.
 */
export async function updateWidgetAsset(
  teamSlug: string,
  assetId: string,
  newName: string,
  newFilePath: string,
  mimeType: string
): Promise<UpdateWidgetResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to edit widgets.' }
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

  // Only widget types may be edited through this action
  if (!mimeType.startsWith('application/x-widget')) {
    return { success: false, error: 'Only widget assets can be edited with this action.' }
  }

  // Verify the asset exists and belongs to the caller's team
  const { data: existing, error: fetchError } = await supabase
    .from('assets')
    .select('id, team_id, mime_type, file_path, file_name, folder_id')
    .eq('id', assetId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Widget not found.' }
  }

  if (existing.team_id !== teamId) {
    console.warn(`[updateWidgetAsset] Unauthorized: user ${user.id} (team ${teamId}) attempted to edit asset ${assetId} (team ${existing.team_id})`)
    return { success: false, error: 'You do not have permission to edit this widget.' }
  }

  if (existing.mime_type !== mimeType) {
    return { success: false, error: 'Widget type mismatch.' }
  }

  // ── Validate name ──────────────────────────────────────────────────────────
  const trimmedName = newName.trim()
  if (!trimmedName || trimmedName.length > 100) {
    return { success: false, error: 'Widget name must be between 1 and 100 characters.' }
  }

  // Check duplicate name within the same folder, excluding the current asset
  let duplicateQuery = supabase
    .from('assets')
    .select('id')
    .eq('team_id', teamId)
    .ilike('file_name', trimmedName)
    .neq('id', assetId)

  if (existing.folder_id) {
    duplicateQuery = duplicateQuery.eq('folder_id', existing.folder_id)
  } else {
    duplicateQuery = duplicateQuery.is('folder_id', null)
  }

  const { data: duplicateName } = await duplicateQuery
  if (duplicateName && duplicateName.length > 0) {
    return { success: false, error: 'An asset or widget with this name already exists in this folder.' }
  }

  // ── Per-type payload validation (mirrors insertAsset logic) ────────────────
  let sanitizedPath = newFilePath

  if (mimeType === 'application/x-widget-website') {
    if (typeof newFilePath !== 'string') {
      return { success: false, error: 'Invalid Website URL.' }
    }
    let normalized = newFilePath.trim()
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized
    }
    try {
      new URL(normalized)
    } catch {
      return { success: false, error: 'Invalid URL format.' }
    }
    sanitizedPath = normalized
  }

  if (mimeType === 'application/x-widget-worldclock') {
    try {
      const config = JSON.parse(newFilePath)
      if (config.clockType !== 'analog' && config.clockType !== 'digital') {
        return { success: false, error: 'Invalid clock type.' }
      }
      if (typeof config.timezone !== 'string' || config.timezone.trim().length === 0 || config.timezone.length > 100) {
        return { success: false, error: 'Invalid timezone.' }
      }
      if (config.theme !== 'light' && config.theme !== 'dark' && config.theme !== 'custom') {
        return { success: false, error: 'Invalid theme option.' }
      }
      if (config.themeSettings) {
        const hexRegex = /^#([0-9a-fA-F]{3}){1,2}$/
        if (config.themeSettings.backgroundColor && !hexRegex.test(config.themeSettings.backgroundColor)) {
          return { success: false, error: 'Invalid background color format.' }
        }
        if (config.themeSettings.textColor && !hexRegex.test(config.themeSettings.textColor)) {
          return { success: false, error: 'Invalid text color format.' }
        }
      }
    } catch {
      return { success: false, error: 'Invalid widget configuration.' }
    }
  }

  if (mimeType === 'application/x-widget-countup' || mimeType === 'application/x-widget-countdown') {
    try {
      const config = JSON.parse(newFilePath)
      if (typeof config.text !== 'string' || config.text.trim().length === 0 || config.text.length > 150) {
        return { success: false, error: 'Heading text is invalid or exceeds 150 characters.' }
      }
      if (config.endMessage && (typeof config.endMessage !== 'string' || config.endMessage.length > 200)) {
        return { success: false, error: 'End message exceeds 200 characters.' }
      }
      if (config.themeSettings) {
        const hexRegex = /^#([0-9a-fA-F]{3}){1,2}$/
        if (config.themeSettings.primaryColor && !hexRegex.test(config.themeSettings.primaryColor)) {
          return { success: false, error: 'Invalid primary color format.' }
        }
        if (config.themeSettings.secondaryColor && !hexRegex.test(config.themeSettings.secondaryColor)) {
          return { success: false, error: 'Invalid secondary color format.' }
        }
        if (config.themeSettings.textColor && !hexRegex.test(config.themeSettings.textColor)) {
          return { success: false, error: 'Invalid text color format.' }
        }
        const bg = config.themeSettings.backgroundColor
        if (bg && !hexRegex.test(bg) && !bg.startsWith('linear-gradient')) {
          return { success: false, error: 'Invalid background color format.' }
        }
        if (config.themeSettings.backgroundImage) {
          try {
            const parsed = new URL(config.themeSettings.backgroundImage)
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
              return { success: false, error: 'Background image URL must use HTTP or HTTPS.' }
            }
          } catch {
            return { success: false, error: 'Invalid background image URL.' }
          }
        }
      }
    } catch {
      return { success: false, error: 'Invalid widget configuration.' }
    }
  }

  if (mimeType === 'application/x-widget-youtube') {
    if (typeof newFilePath !== 'string' || (!newFilePath.includes('youtube.com') && !newFilePath.includes('youtu.be'))) {
      return { success: false, error: 'Invalid YouTube URL.' }
    }
  }

  if (mimeType === 'application/x-widget-qrcode') {
    try {
      const config = JSON.parse(newFilePath)
      if (typeof config.url !== 'string' || config.url.trim().length === 0 || config.url.length > 2000) {
        return { success: false, error: 'Invalid QR Code URL or URL exceeds 2000 characters.' }
      }
    } catch {
      return { success: false, error: 'Invalid QR Code configuration.' }
    }
  }

  if (mimeType === 'application/x-widget-remote-url') {
    try {
      const parsed = new URL(newFilePath)
      if (parsed.protocol !== 'https:') {
        return { success: false, error: 'Remote URLs must use HTTPS for security.' }
      }
    } catch {
      return { success: false, error: 'Invalid URL.' }
    }
  }

  if (mimeType === 'application/x-widget-html') {
    try {
      const { html = '', css = '' } = JSON.parse(newFilePath)
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
          'br', 'img', 'a', 'strong', 'em', 'b', 'i', 'u', 'table', 'thead', 'tbody',
          'tr', 'th', 'td', 'style'
        ],
        ALLOWED_ATTR: ['class', 'style', 'src', 'href', 'target', 'alt', 'width', 'height']
      })
      sanitizedPath = JSON.stringify({ html: sanitizedHtml, css })
    } catch {
      return { success: false, error: 'Invalid HTML widget data.' }
    }
  }

  // ── Update the asset record ────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('assets')
    .update({
      file_name: trimmedName,
      file_path: sanitizedPath,
    })
    .eq('id', assetId)
    .eq('team_id', teamId)

  if (updateError) {
    console.error('[updateWidgetAsset] update error:', { message: updateError.message, details: updateError.details })
    return { success: false, error: 'Failed to save widget changes. Please try again.' }
  }

  // ── Cascade content update to all devices using this widget ───────────────
  // This triggers the player's existing postgres_changes subscription on `devices`,
  // causing every connected screen to re-render immediately with the new content.
  await supabase
    .from('devices')
    .update({ content: sanitizedPath })
    .eq('asset_id', assetId)
    .eq('team_id', teamId)
  // Non-fatal: offline devices will pick up the change on next reconnect via getDeviceState.

  // ── Write audit log ────────────────────────────────────────────────────────
  try {
    await supabase
      .from('widget_edit_logs')
      .insert({
        asset_id: assetId,
        team_id: teamId,
        edited_by: user.id,
        previous_name: existing.file_name,
        new_name: trimmedName,
        previous_path: existing.file_path,
        new_path: sanitizedPath,
      })
  } catch (auditErr) {
    // Non-fatal: log but don't block the save
    console.error('[updateWidgetAsset] Failed to write audit log:', auditErr)
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}

export interface FetchFolderFilesResult {
  success: boolean
  files?: any[]
  error?: string
}

export async function fetchFolderFiles(
  teamSlug: string,
  folderId: string | null
): Promise<FetchFolderFilesResult> {
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
    const query = supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
      .eq('team_id', teamId)
      .neq('mime_type', 'application/x-folder')
      .order('created_at', { ascending: false })

    if (folderId) {
      query.eq('folder_id', folderId)
    } else {
      query.is('folder_id', null)
    }

    const { data: files, error } = await query

    if (error) {
      console.error('[fetchFolderFiles] error:', error)
      return { success: false, error: 'Failed to fetch folder assets.' }
    }

    return { success: true, files: files || [] }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

const dnsLookup = promisify(dns.lookup)

function isPrivateIp(ip: string): boolean {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0') return true
  
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(x => parseInt(x, 10))
    if (parts.length === 4) {
      const first = parts[0]
      const second = parts[1]
      
      if (first === 127) return true // Loopback: 127.0.0.0/8
      if (first === 10) return true  // Private: 10.0.0.0/8
      if (first === 169 && second === 254) return true // Link-local: 169.254.0.0/16
      if (first === 192 && second === 168) return true // Private: 192.168.0.0/16
      if (first === 172 && second >= 16 && second <= 31) return true // Private: 172.16.0.0/12
      if (first === 0) return true // Local broadcast
      if (first >= 224) return true // Multicast/Reserved
    }
  } else if (net.isIPv6(ip)) {
    const cleanIp = ip.toLowerCase()
    if (cleanIp === '::1' || cleanIp === '::') return true
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) {
      return true
    }
  }
  return false
}

export interface FrameabilityResult {
  frameable: boolean
  reason: 'x-frame-options' | 'csp-frame-ancestors' | 'network-error' | 'invalid-url' | 'ssrf-attempt' | null
}

export async function checkUrlFrameability(urlInput: string): Promise<FrameabilityResult> {
  let normalized = urlInput.trim()
  if (!normalized) {
    return { frameable: false, reason: 'invalid-url' }
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalized)
  } catch {
    return { frameable: false, reason: 'invalid-url' }
  }

  // 1. SSRF check - Resolve DNS
  try {
    const hostname = parsedUrl.hostname
    // Verify standard ports
    if (parsedUrl.port && parsedUrl.port !== '80' && parsedUrl.port !== '443') {
      return { frameable: false, reason: 'ssrf-attempt' }
    }

    const lookupResult = await dnsLookup(hostname).catch(() => null)
    if (!lookupResult || !lookupResult.address) {
      return { frameable: false, reason: 'network-error' }
    }

    const ip = lookupResult.address
    if (isPrivateIp(ip)) {
      console.warn(`[SSRF Prevention] Blocked request to private IP: ${ip} for host: ${hostname}`)
      return { frameable: false, reason: 'ssrf-attempt' }
    }
  } catch (err) {
    console.error('DNS Lookup Error in checkUrlFrameability:', err)
    return { frameable: false, reason: 'network-error' }
  }

  // 2. Fetch the URL headers with a short timeout
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    // Perform request with redirect manually handled to prevent redirect-based SSRF
    const response = await fetch(normalized, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NuExisSignagePlayer/1.0',
      },
      signal: controller.signal,
      redirect: 'manual',
    })
    clearTimeout(id)

    // Redirect handling
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        const redirectUrl = new URL(location, normalized).toString()
        return checkUrlFrameability(redirectUrl)
      }
    }

    const headers = response.headers

    // Check X-Frame-Options
    const xfo = headers.get('x-frame-options')
    if (xfo) {
      const val = xfo.toUpperCase().trim()
      if (val === 'DENY' || val === 'SAMEORIGIN' || val.startsWith('ALLOW-FROM')) {
        return { frameable: false, reason: 'x-frame-options' }
      }
    }

    // Check Content-Security-Policy (CSP)
    const csp = headers.get('content-security-policy')
    if (csp) {
      const directives = csp.split(';')
      for (const directive of directives) {
        const trimmed = directive.trim()
        if (trimmed.startsWith('frame-ancestors')) {
          const parts = trimmed.split(/\s+/).slice(1)
          const hasWildcard = parts.includes('*')
          if (!hasWildcard) {
            return { frameable: false, reason: 'csp-frame-ancestors' }
          }
        }
      }
    }

    return { frameable: true, reason: null }
  } catch (err: any) {
    console.error('Error fetching frameability check:', err)
    return { frameable: false, reason: 'network-error' }
  }
}

