export type LiveStatus = 'online' | 'offline' | 'pairing'

export interface Device {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  created_at: string
  content_type?: string | null
  asset_id?: string | null
  playlist_id?: string | null
  orientation?: number | null
  last_seen_at?: string | null
  total_playtime_seconds?: number | null
}

export interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  created_at?: string
}

export interface Playlist {
  id: string
  name: string
  created_at?: string | null
  playlist_items?: { duration_seconds: number }[]
}
