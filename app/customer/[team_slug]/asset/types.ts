export interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  created_at: string
  folder_id?: string | null
  color?: string | null
}

export interface ScreenDevice {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  content_type?: string | null
  asset_id?: string | null
  playlist_id?: string | null
  content?: string | null
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

export function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

export function isWidget(mimeType: string) {
  return mimeType.startsWith('application/x-widget')
}
