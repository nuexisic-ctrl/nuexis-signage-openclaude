import { SupabaseClient } from '@supabase/supabase-js'

interface CacheEntry {
  url: string
  expiresAt: number
}

// Global cache object that persists across component remounts
const signedUrlCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<string | null>>()

/**
 * Gets a cached signed URL for a file path, or creates one if it doesn't exist or is close to expiring.
 * Deduplicates concurrent requests for the same file path.
 */
export async function getCachedSignedUrl(
  supabase: SupabaseClient<any, any, any>,
  filePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const cacheKey = filePath
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5 minutes buffer before expiration

  // Check if we have a valid cached URL
  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > now + bufferMs) {
    return cached.url
  }

  // Check if there is an active promise for this filePath
  const pending = pendingRequests.get(cacheKey)
  if (pending) {
    return pending
  }

  // Define the promise to fetch the signed URL
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from('workspace-media')
        .createSignedUrl(filePath, expiresInSeconds)

      if (error || !data?.signedUrl) {
        console.error(`Error generating signed URL for ${filePath}:`, error)
        return null
      }

      // Cache the result
      signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      })

      return data.signedUrl
    } catch (err) {
      console.error(`Exception generating signed URL for ${filePath}:`, err)
      return null
    } finally {
      // Remove from pending requests once finished
      pendingRequests.delete(cacheKey)
    }
  })()

  pendingRequests.set(cacheKey, fetchPromise)
  return fetchPromise
}
