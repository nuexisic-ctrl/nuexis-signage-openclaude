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

  const { data, error } = await supabase
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
    console.error('[insertAsset] error:', error)
    return { success: false, error: `Failed to save asset metadata: ${error.message}` }
  }

  revalidatePath(`/customer/${teamSlug}/content`)
  return { success: true, id: data.id }
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

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('workspace-media')
    .remove([filePath])

  if (storageError) {
    console.error('[deleteAsset] storage error:', storageError)
    return { success: false, error: `Failed to remove file from storage: ${storageError.message}` }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)

  if (dbError) {
    console.error('[deleteAsset] db error:', dbError)
    return { success: false, error: `Failed to delete asset record: ${dbError.message}` }
  }

  revalidatePath(`/customer/${teamSlug}/content`)
  return { success: true }
}
