-- Phase 1 Critical Security Fixes
-- 1. Exclude secret from Realtime publication on devices table
ALTER PUBLICATION supabase_realtime DROP TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices (
  id, team_id, name, pairing_code, status, expires_at,
  content_type, asset_id, orientation, last_seen_at,
  total_playtime_seconds, playlist_id
);

-- 2. Revoke TRUNCATE, TRIGGER, and REFERENCES privileges on all public tables from anon and authenticated roles
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 3. Create claim_attempts table if not exists
CREATE TABLE IF NOT EXISTS public.claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  attempted_at timestamptz DEFAULT now(),
  ip_address text,
  pairing_code text
);

-- 4. Define/restore device_secret_matches function
CREATE OR REPLACE FUNCTION public.device_secret_matches(
  p_device public.devices,
  p_secret text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN p_secret IS NOT NULL
    AND p_device.secret IS NOT NULL
    AND p_device.secret = extensions.crypt(p_secret, p_device.secret);
END;
$$;

-- 5. Attach trigger enforce_anon_heartbeat if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'devices' AND trigger_name = 'enforce_anon_heartbeat'
  ) THEN
    CREATE TRIGGER enforce_anon_heartbeat
      BEFORE UPDATE ON public.devices
      FOR EACH ROW EXECUTE FUNCTION check_anon_heartbeat_update();
  END IF;
END;
$$;

-- 6. Secure get_player_playlist_items RPC and drop the old overload
DROP FUNCTION IF EXISTS public.get_player_playlist_items(uuid);

CREATE OR REPLACE FUNCTION public.get_player_playlist_items(
  p_hardware_id text,
  p_secret text,
  p_playlist_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_playlist public.playlists;
BEGIN
  SELECT *
    INTO v_device
    from public.devices
    WHERE hardware_id = p_hardware_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_device.id IS NULL
     OR v_device.team_id IS NULL
     OR NOT public.device_secret_matches(v_device, p_secret) THEN
    RAISE EXCEPTION 'Unauthorized device';
  END IF;

  SELECT *
    INTO v_playlist
    from public.playlists
    WHERE id = p_playlist_id;

  IF v_playlist.id IS NULL OR v_playlist.team_id IS DISTINCT FROM v_device.team_id THEN
    RAISE EXCEPTION 'Unauthorized playlist access';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'playlist_id', pi.playlist_id,
        'type', pi.type,
        'asset_id', pi.asset_id,
        'widget_type', pi.widget_type,
        'widget_config', pi.widget_config,
        'duration_seconds', pi.duration_seconds,
        'sort_order', pi.sort_order,
        'assets', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
          'file_path', a.file_path,
          'mime_type', a.mime_type
        ) END
      )
      ORDER BY pi.sort_order
    ), '[]'::jsonb)
    from public.playlist_items pi
    LEFT JOIN public.assets a ON a.id = pi.asset_id AND a.team_id = v_device.team_id
    WHERE pi.playlist_id = p_playlist_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_playlist_items(text, text, uuid) TO anon, authenticated;

-- 7. Revoke EXECUTE on administrative RPCs from anon role
REVOKE EXECUTE ON FUNCTION public.claim_device(text, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_playlist_atomic(uuid, text, uuid, jsonb) FROM anon;
