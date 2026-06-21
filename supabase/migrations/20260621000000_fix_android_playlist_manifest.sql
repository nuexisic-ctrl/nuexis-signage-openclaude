-- ============================================================
-- MIGRATION: Fix Android Playlist Manifest (Add Widget Fields)
-- Date: 2026-06-21
-- ============================================================

-- 1. Update trg_fn_precompute_manifest_version
CREATE OR REPLACE FUNCTION public.trg_fn_precompute_manifest_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_resolved public.devices;
  v_items jsonb := '[]'::jsonb;
BEGIN
  -- Calculate only on configuration/orientational/updated_at changes
  IF TG_OP = 'INSERT' OR
     OLD.content_type IS DISTINCT FROM NEW.content_type OR
     OLD.asset_id IS DISTINCT FROM NEW.asset_id OR
     OLD.playlist_id IS DISTINCT FROM NEW.playlist_id OR
     OLD.orientation IS DISTINCT FROM NEW.orientation OR
     OLD.updated_at IS DISTINCT FROM NEW.updated_at THEN
     
    -- Resolve screen group configurations using NEW record
    v_resolved := public.resolve_device_state(NEW);
    
    -- Compile playlist items
    IF v_resolved.content_type = 'Asset' AND v_resolved.asset_id IS NOT NULL THEN
      SELECT jsonb_build_array(
        jsonb_build_object(
          'id', v_resolved.asset_id,
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
      WHERE a.id = v_resolved.asset_id
        AND a.team_id = v_resolved.team_id;
    ELSIF v_resolved.content_type = 'Playlist' AND v_resolved.playlist_id IS NOT NULL THEN
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
      LEFT JOIN public.assets a ON a.id = pi.asset_id AND a.team_id = v_resolved.team_id
      WHERE pi.playlist_id = v_resolved.playlist_id;
    END IF;

    -- Precompute the SHA-256 hash representation of the manifest content
    NEW.current_manifest_version := encode(
      digest(
        coalesce(v_resolved.content_type, '') || ':' ||
        coalesce(v_resolved.asset_id::text, '') || ':' ||
        coalesce(v_resolved.playlist_id::text, '') || ':' ||
        coalesce(v_resolved.orientation::text, '0') || ':' ||
        v_items::text,
        'sha256'
      ),
      'hex'
    );
    
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Update get_player_manifest
CREATE OR REPLACE FUNCTION public.get_player_manifest(
  p_device_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_items jsonb := '[]'::jsonb;
  v_manifest_version text;
BEGIN
  -- validate_device_session returns resolved group variables
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
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

  v_manifest_version := COALESCE(v_device.current_manifest_version, '');

  -- Update online presence details, throttle writing overhead
  UPDATE public.devices
  SET last_seen_at = now(),
      status = 'online'
  WHERE id = v_device.id
    AND (
      status IS DISTINCT FROM 'online'
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
