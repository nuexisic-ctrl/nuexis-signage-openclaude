export interface Group {
  id: string
  team_id: string
  name: string
  color: string | null
  content_type: string | null
  asset_id: string | null
  playlist_id: string | null
  orientation: number | null
  created_at: string | null
}

export interface Device {
  id: string
  name: string | null
  status: string
  last_seen_at: string | null
}

export interface Membership {
  group_id: string
  device_id: string
  is_primary: boolean | null
}
