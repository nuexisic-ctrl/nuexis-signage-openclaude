import { getPlayerAsset, getSignedMediaUrl } from './actions'

export async function cleanupOldCaches(currentUrlToKeep: string) {
  if (typeof window === 'undefined' || !('caches' in window)) return
  try {
    const cache = await caches.open('nuexis-media-cache')
    const keys = await cache.keys()
    for (const request of keys) {
      if (request.url !== currentUrlToKeep) {
        await cache.delete(request)
      }
    }
  } catch (err) {
    console.error('Failed to clean up old caches', err)
  }
}

interface ResolveAssetParams {
  assetId: string | null
  hardwareId: string
  secret: string
  onResolve: (url: string | null, mimeType: string | null, blobUrl: string | null) => void
  onClear: () => void
  isCancelled: () => boolean
}

export async function resolveAsset({
  assetId,
  hardwareId,
  secret,
  onResolve,
  onClear,
  isCancelled,
}: ResolveAssetParams) {
  if (!assetId) {
    onClear()
    return
  }

  try {
    const asset = await getPlayerAsset(assetId, hardwareId, secret)
    if (isCancelled()) return

    if (!asset) {
      onClear()
      return
    }

    if (asset.mime_type === 'application/x-widget-qrcode') {
      try {
        const config = JSON.parse(asset.file_path)
        if (config.png_path) {
          asset.file_path = config.png_path
          asset.mime_type = 'image/png'
        }
      } catch (err) {
        console.error('Failed to parse qrcode widget path in resolver:', err)
      }
    }

    const isWidget =
      asset.mime_type === 'application/x-widget-youtube' ||
      asset.mime_type === 'application/x-widget-remote-url' ||
      asset.mime_type === 'application/x-widget-html' ||
      asset.mime_type === 'application/x-widget-flow' ||
      asset.mime_type === 'application/x-widget-countdown' ||
      asset.mime_type === 'application/x-widget-countup'

    if (isWidget) {
      onResolve(asset.file_path, asset.mime_type, null)
      return
    }

    const cacheKey = `https://local-media-cache/${asset.file_path}`

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await caches.open('nuexis-media-cache')
        let response = await cache.match(cacheKey)

        if (isCancelled()) return

        if (!response) {
          const mediaUrl = await getSignedMediaUrl(asset.file_path, hardwareId, secret)
          if (isCancelled()) return
          response = await fetch(mediaUrl, { mode: 'cors' })
          if (response.ok) {
            await cache.put(cacheKey, response.clone())
          }
        }

        if (isCancelled()) return

        if (response?.ok) {
          const blob = await response.blob()
          if (isCancelled()) return
          const localBlobUrl = URL.createObjectURL(blob)
          onResolve(localBlobUrl, asset.mime_type, localBlobUrl)
          cleanupOldCaches(cacheKey)
        } else {
          throw new Error('Failed to load media')
        }
      } catch {
        if (isCancelled()) return
        const mediaUrl = await getSignedMediaUrl(asset.file_path, hardwareId, secret).catch(() => null)
        if (isCancelled()) return
        if (mediaUrl) {
          onResolve(mediaUrl, asset.mime_type, null)
        }
      }
    } else {
      // Graceful fallback for non-secure HTTP environments (Cache Storage is disabled)
      if (isCancelled()) return
      const mediaUrl = await getSignedMediaUrl(asset.file_path, hardwareId, secret).catch(() => null)
      if (isCancelled()) return
      if (mediaUrl) {
        onResolve(mediaUrl, asset.mime_type, null)
      }
    }
  } catch (err) {
    console.error('Failed to resolve asset in player:', err)
    onClear()
  }
}
