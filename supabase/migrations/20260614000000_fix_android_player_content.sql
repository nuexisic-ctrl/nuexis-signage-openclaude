-- Migration: Fix Android Player Content Push
-- 
-- Fixes:
-- 1. Create missing `get_player_signed_media_url_by_session` RPC (called by /api/player/media-url)
-- 2. Update `get_player_manifest` to include widget_type/widget_config in playlist items

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Create the missing session-based signed URL RPC
-- ═══════════════════════════════════════════════════════════════════════
-- The /api/player/media-url endpoint calls this RPC to generate signed
-- URLs for media files. Without it, all Android media downloads fail.

CREATE OR REPLACE FUNCTION public.get_player_signed_media_url_by_session(
  p_device_id uuid,
  p_session_token text,
  p_file_path text,
  p_expires_in integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  v_device public.devices;
  v_bucket text := 'workspace-media';
  v_signed record;
BEGIN
  IF p_file_path IS NULL OR length(trim(p_file_path)) = 0 THEN
    RAISE EXCEPTION 'file path required';
  END IF;

  -- Pass through external URLs
  IF p_file_path LIKE 'http://%' OR p_file_path LIKE 'https://%' THEN
    RETURN p_file_path;
  END IF;

  -- Validate session token and get device
  v_device := jsonb_populate_record(
    null::public.devices,
    public.validate_device_session(p_device_id, p_session_token)
  );

  IF v_device.id IS NULL OR v_device.team_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized device session';
  END IF;

  -- Validate file path belongs to device's team
  IF NOT p_file_path LIKE v_device.team_id::text || '/%' THEN
    RAISE EXCEPTION 'Unauthorized file path';
  END IF;

  -- Generate signed URL
  SELECT * INTO v_signed
    FROM storage.create_signed_url(v_bucket, p_file_path, p_expires_in);

  IF v_signed.signed_url IS NULL THEN
    RAISE EXCEPTION 'Failed to generate signed URL';
  END IF;

  RETURN v_signed.signed_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_signed_media_url_by_session(uuid, text, text, integer)
  TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Update get_player_manifest to include widget fields in playlist items
-- ═══════════════════════════════════════════════════════════════════════
-- validate_device_session already calls resolve_device_state internally,
-- so group-level content is resolved automatically.

CREATE OR REPLACE FUNCTION public.get_player_manifest(
  p_device_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_items jsonb := '[]'::jsonb;
  v_manifest_version text;
BEGIN
  v_device := jsonb_populate_record(
    null::public.devices,
    public.validate_device_session(p_device_id, p_session_token)
  );
  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized device session';
  END IF;

  IF v_device.content_type = 'Asset' AND v_device.asset_id IS NOT NULL THEN
    SELECT jsonb_build_array(
      jsonb_build_object(
        'id', v_device.asset_id,
        'type', CASE WHEN a.mime_type LIKE 'video/%' THEN 'video' WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'widget' END,
        'asset_id', a.id,
        'duration_seconds', 15,
        'sort_order', 0,
        'asset', jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'file_path', a.file_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes
        )
      )
    )
    INTO v_items
    FROM public.assets a
    WHERE a.id = v_device.asset_id
      AND a.team_id = v_device.team_id;
  ELSIF v_device.content_type = 'Playlist' AND v_device.playlist_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'type', pi.type,
        'asset_id', pi.asset_id,
        'duration_seconds', pi.duration_seconds,
        'sort_order', pi.sort_order,
        'asset', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'file_path', a.file_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes
        ) END,
        'widget_type', pi.widget_type,
        'widget_config', pi.widget_config
      )
      ORDER BY pi.sort_order
    ), '[]'::jsonb)
    INTO v_items
    FROM public.playlist_items pi
    LEFT JOIN public.assets a ON a.id = pi.asset_id AND a.team_id = v_device.team_id
    WHERE pi.playlist_id = v_device.playlist_id;
  END IF;

  v_manifest_version := encode(
    digest(
      coalesce(v_device.content_type, '') || ':' ||
      coalesce(v_device.asset_id::text, '') || ':' ||
      coalesce(v_device.playlist_id::text, '') || ':' ||
      coalesce(v_device.orientation::text, '0') || ':' ||
      v_items::text,
      'sha256'
    ),
    'hex'
  );

  UPDATE public.devices
  SET current_manifest_version = v_manifest_version,
      last_seen_at = now(),
      status = 'online'
  WHERE id = v_device.id
    AND (
      current_manifest_version IS DISTINCT FROM v_manifest_version
      OR status IS DISTINCT FROM 'online'
      OR last_seen_at IS NULL
      OR last_seen_at < now() - interval '5 minutes'
    );

  RETURN jsonb_build_object(
    'manifest_version', v_manifest_version,
    'device_id', v_device.id,
    'team_id', v_device.team_id,
    'content_type', v_device.content_type,
    'orientation', coalesce(v_device.orientation, 0),
    'loop_enabled', true,
    'transition_ms', 350,
    'assignment', jsonb_build_object('asset_id', v_device.asset_id, 'playlist_id', v_device.playlist_id),
    'playlist', v_items
  );
END;
$$;
