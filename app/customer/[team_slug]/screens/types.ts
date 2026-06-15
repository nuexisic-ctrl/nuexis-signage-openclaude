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
  app_version?: string | null
  os_version?: string | null
  scale_mode?: string | null
}

import { Asset } from '../assets/types'
export type { Asset }

export interface PlaylistItem {
  duration_seconds: number
  widget_type?: string | null
  assets?: Asset | null
}

export interface Playlist {
  id: string
  name: string
  created_at?: string | null
  playlist_items?: PlaylistItem[]
}
