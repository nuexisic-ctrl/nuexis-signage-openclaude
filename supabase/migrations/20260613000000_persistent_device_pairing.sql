-- Migration: Add current_manifest_version column to devices table if not exists
-- This column is queried and updated by the get_player_manifest RPC, and its absence
-- causes player session handshakes (exchange_device_secret_for_session) to fail with 400 errors.

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS current_manifest_version text;

-- Update the realtime publication to include current_manifest_version alongside other safe fields
ALTER PUBLICATION supabase_realtime DROP TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices (
  id, team_id, name, pairing_code, status, expires_at,
  content_type, asset_id, orientation, last_seen_at,
  total_playtime_seconds, playlist_id, current_manifest_version
);
