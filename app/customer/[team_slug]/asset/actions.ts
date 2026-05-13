'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  if (!asset.file_path.startsWith(`${profile.team_id}/`)) {
    return { success: false, error: 'Invalid file path.' }
  }

  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )

  const { data, error } = await adminSupabase
    .from('assets')
    .insert({
      team_id: profile.team_id,
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

import { createServerClient } from '@supabase/ssr'

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team.' }
  }

  const path = `${profile.team_id}/${Date.now()}-${fileName}`

  // Use service role client to bypass RLS for creating the signed URL
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )

  const { data, error } = await adminSupabase.storage
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
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.team_id) {
    return { success: false, error: 'Could not determine your team. Please try again.' }
  }

  // ── Verify ownership before touching anything ──────────────────────────────
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, team_id, file_path')
    .eq('id', assetId)
    .single()

  if (assetError || !asset) {
    return { success: false, error: 'Asset not found.' }
  }

  if (asset.team_id !== profile.team_id) {
    console.warn(
      `[deleteAsset] Unauthorized: user ${user.id} (team ${profile.team_id}) ` +
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
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )

  const { error: storageError } = await adminSupabase.storage
    .from('workspace-media')
    .remove([filePath])

  if (storageError) {
    console.error('[deleteAsset] storage error:', storageError)
    return { success: false, error: 'An unexpected error occurred while managing your media.' }
  }

  // ── Delete from database (double-lock: ownership filter + RLS) ────────────
  const { error: dbError } = await adminSupabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('team_id', profile.team_id)

  if (dbError) {
    console.error('[deleteAsset] db error:', { message: dbError.message, details: dbError.details, hint: dbError.hint })
    return { success: false, error: 'An unexpected error occurred while managing your media.' }
  }

  revalidatePath(`/customer/${teamSlug}/asset`)
  return { success: true }
}
