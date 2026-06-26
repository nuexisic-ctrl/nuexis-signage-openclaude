-- Migration: Update Supabase Realtime Publication for Devices Table
-- 
-- Includes all safe columns of public.devices table (including updated_at and scale_mode)
-- in the supabase_realtime publication, while maintaining the exclusion of the secret column.

ALTER PUBLICATION supabase_realtime DROP TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices (
  id,
  team_id,
  name,
  pairing_code,
  status,
  expires_at,
  created_at,
  hardware_id,
  content_type,
  asset_id,
  orientation,
  last_seen_at,
  total_playtime_seconds,
  playlist_id,
  content,
  current_manifest_version,
  app_version,
  os_version,
  free_disk_bytes,
  memory_class_mb,
  network_type,
  last_error,
  scale_mode,
  updated_at,
  cache_percent,
  cache_status
);
