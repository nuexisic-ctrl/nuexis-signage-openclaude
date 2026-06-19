import { createClient } from '@/lib/supabase/client'

/**
 * Creates a short-lived signed URL for downloading a file from Supabase storage
 * and triggers the download in the browser.
 */
export async function downloadAsset(filePath: string, fileName: string) {
  try {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('workspace-media')
      .createSignedUrl(filePath, 60, {
        download: fileName,
      })
    if (data?.signedUrl) {
      window.location.href = data.signedUrl
    }
  } catch (err) {
    console.error('Failed to download asset:', err)
  }
}
