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

  if (asset.mime_type === 'application/x-widget-slideshow') {
    try {
      const config = JSON.parse(asset.file_path)
      if (config.animation !== 'fade' && config.animation !== 'slide-left' && config.animation !== 'slide-right' && config.animation !== 'zoom-in' && config.animation !== 'zoom-out') {
        return { success: false, error: 'Invalid transition animation.' }
      }
      if (typeof config.duration !== 'number' || config.duration < 1 || config.duration > 300) {
        return { success: false, error: 'Duration must be between 1 and 300 seconds.' }
      }
      if (!Array.isArray(config.images) || config.images.length === 0) {
        return { success: false, error: 'At least one image must be selected.' }
      }
      if (config.images.length > 50) {
        return { success: false, error: 'A maximum of 50 images is allowed.' }
      }
      for (const img of config.images) {
        if (typeof img.id !== 'string' || typeof img.file_path !== 'string' || typeof img.file_name !== 'string') {
          return { success: false, error: 'Invalid image reference.' }
        }
      }
    } catch {
      return { success: false, error: 'Invalid slideshow configuration.' }
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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
  if (!asset.mime_type.startsWith('application/x-widget') && asset.mime_type !== 'application/x-folder') {
    const { error: storageError } = await supabase.storage
      .from('workspace-media')
      .remove([filePath])

    if (storageError) {
      // Log as a warning but proceed so database record can still be deleted if storage is out of sync
      console.warn('[deleteAsset] storage removal warning (proceeding):', storageError)
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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
  revalidatePath(`/customer/${teamSlug}/assets`)
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
    .select('id, team_id, file_path, file_name, mime_type')
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

  // Record content push in activity log
  try {
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        team_id: teamId,
        device_id: deviceId,
        event_type: 'content_push',
        description: `Pushed asset: ${asset.file_name || 'Unnamed Asset'}`,
        metadata: {
          asset_id: assetId,
          content_type: 'Asset',
          file_name: asset.file_name,
          mime_type: asset.mime_type
        }
      })
    if (logError) {
      console.error('[pushAssetToScreen] Failed to insert activity log:', logError)
    }
  } catch (err) {
    console.error('[pushAssetToScreen] Activity logging failed:', err)
  }

  revalidatePath(`/customer/${teamSlug}/screens`)
  revalidatePath(`/customer/${teamSlug}/assets`)
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
    .filter(a => !a.mime_type.startsWith('application/x-widget') && a.mime_type !== 'application/x-folder')
    .map(a => a.file_path)

  if (storageFiles.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('workspace-media')
      .remove(storageFiles)

    if (storageError) {
      // Log as a warning but proceed so database records can still be deleted if storage is out of sync
      console.warn('[deleteAssetsBulk] storage removal warning (proceeding):', storageError)
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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

    // Cycle detection: ensure none of the assets being moved are parents/ancestors of folderId
    const { data: teamFolders, error: foldersError } = await supabase
      .from('assets')
      .select('id, folder_id')
      .eq('team_id', teamId)
      .eq('mime_type', 'application/x-folder')

    if (foldersError) {
      console.error('[moveAssetsToFolder] error fetching team folders:', foldersError)
      return { success: false, error: 'Failed to validate folder structure.' }
    }

    let currentParentId: string | null = folderId
    const visited = new Set<string>()
    while (currentParentId) {
      if (visited.has(currentParentId)) {
        console.error('[moveAssetsToFolder] Circular dependency detected in existing folders for team:', teamId)
        break
      }
      visited.add(currentParentId)
      if (assetIds.includes(currentParentId)) {
        return { success: false, error: 'Cannot move a folder into itself or one of its subfolders.' }
      }
      const parent = teamFolders?.find(f => f.id === currentParentId)
      currentParentId = parent ? parent.folder_id : null
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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
    .select('id, team_id, mime_type, file_path, file_name')
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

  // ── Per-type payload validation (mirrors insertAsset logic) ────────────────
  let sanitizedPath = newFilePath

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

  if (mimeType === 'application/x-widget-slideshow') {
    try {
      const config = JSON.parse(newFilePath)
      if (config.animation !== 'fade' && config.animation !== 'slide-left' && config.animation !== 'slide-right' && config.animation !== 'zoom-in' && config.animation !== 'zoom-out') {
        return { success: false, error: 'Invalid transition animation.' }
      }
      if (typeof config.duration !== 'number' || config.duration < 1 || config.duration > 300) {
        return { success: false, error: 'Duration must be between 1 and 300 seconds.' }
      }
      if (!Array.isArray(config.images) || config.images.length === 0) {
        return { success: false, error: 'At least one image must be selected.' }
      }
      if (config.images.length > 50) {
        return { success: false, error: 'A maximum of 50 images is allowed.' }
      }
      for (const img of config.images) {
        if (typeof img.id !== 'string' || typeof img.file_path !== 'string' || typeof img.file_name !== 'string') {
          return { success: false, error: 'Invalid image reference.' }
        }
      }
    } catch {
      return { success: false, error: 'Invalid slideshow configuration.' }
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

  revalidatePath(`/customer/${teamSlug}/assets`)
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

