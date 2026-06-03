import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params
    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: asset, error: dbError } = await adminClient
      .from('assets')
      .select('file_path, mime_type')
      .eq('id', assetId)
      .single()

    if (dbError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Generate a signed URL with 1 hour expiration
    const { data, error: storageError } = await adminClient.storage
      .from('workspace-media')
      .createSignedUrl(asset.file_path, 3600)

    if (storageError || !data?.signedUrl) {
      console.error('[public/assets/redirect] storage sign error:', storageError)
      return NextResponse.json({ error: 'Failed to retrieve media URL' }, { status: 500 })
    }

    return NextResponse.redirect(data.signedUrl)
  } catch (err: any) {
    console.error('[public/assets/redirect] error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
