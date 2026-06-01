-- ============================================================
-- Migration: Harden DB Performance & Security
-- ============================================================

-- 1. Prevent Profile Privilege Escalation (role/team_id update locking trigger)
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'You cannot modify your role or team membership.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update_limits ON public.profiles;
CREATE TRIGGER enforce_profile_update_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();


-- 2. Define/secure device_secret_matches without plaintext fallback
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


-- 3. Harden register_player_device against spoofing / race-takeover of active hardware IDs
CREATE OR REPLACE FUNCTION public.register_player_device(
  p_hardware_id text,
  p_pairing_code text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_secret text := gen_random_uuid()::text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  SELECT * INTO v_device FROM public.devices WHERE hardware_id = p_hardware_id LIMIT 1;
  
  IF v_device.id IS NOT NULL THEN
    IF v_device.team_id IS NOT NULL THEN
      RAISE EXCEPTION 'Device is already paired.';
    ELSIF v_device.secret IS NOT NULL THEN
      RAISE EXCEPTION 'Device is already registered and holds a secret.';
    ELSE
      -- Handle edge case where row exists but lacks a secret
      UPDATE public.devices
      SET pairing_code = upper(p_pairing_code),
          status = 'pairing',
          expires_at = p_expires_at,
          secret = extensions.crypt(v_secret, extensions.gen_salt('bf'))
      WHERE id = v_device.id
      RETURNING id, expires_at INTO v_id, v_exp;
      
      RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
    END IF;
  END IF;

  INSERT INTO public.devices (hardware_id, pairing_code, status, expires_at, secret)
  VALUES (p_hardware_id, upper(p_pairing_code), 'pairing', p_expires_at, extensions.crypt(v_secret, extensions.gen_salt('bf')))
  RETURNING id, expires_at INTO v_id, v_exp;

  RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
END;
$$;


-- 4. Throttle validate_device_session to reduce write amplification on device_sessions
CREATE OR REPLACE FUNCTION public.validate_device_session(
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
BEGIN
  SELECT d.*
    INTO v_device
    FROM public.devices d
    JOIN public.device_sessions s ON s.device_id = d.id
    WHERE d.id = p_device_id
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND s.token_hash = extensions.crypt(p_session_token, s.token_hash)
    ORDER BY s.issued_at DESC
    LIMIT 1;

  IF v_device.id IS NULL THEN
    RETURN null;
  END IF;

  -- Update session last_seen_at at most once every 5 minutes
  UPDATE public.device_sessions
  SET last_seen_at = now()
  WHERE device_id = p_device_id
    AND revoked_at IS NULL
    AND expires_at > now()
    AND token_hash = extensions.crypt(p_session_token, token_hash)
    AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes');

  RETURN to_jsonb(v_device) - 'secret' - 'device_secret_hash';
END;
$$;


-- 5. Throttle get_player_manifest to prevent write amplification on devices table
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
        ) END
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

  -- Perform devices update only if manifest changed or last_seen_at is older than 5 minutes
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


-- 6. Throttle report_device_health updates to prevent write amplification on devices table
CREATE OR REPLACE FUNCTION public.report_device_health(
  p_device_id uuid,
  p_session_token text,
  p_app_version text DEFAULT NULL::text,
  p_os_version text DEFAULT NULL::text,
  p_free_disk_bytes bigint DEFAULT NULL::bigint,
  p_memory_class_mb integer DEFAULT NULL::integer,
  p_network_type text DEFAULT NULL::text,
  p_manifest_version text DEFAULT NULL::text,
  p_current_item_id uuid DEFAULT NULL::uuid,
  p_last_error text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
BEGIN
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized device session';
  END IF;

  INSERT INTO public.device_health_events(
    device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb,
    network_type, manifest_version, current_item_id, last_error
  )
  VALUES (
    v_device.id, v_device.team_id, p_app_version, p_os_version, p_free_disk_bytes, p_memory_class_mb,
    p_network_type, p_manifest_version, p_current_item_id, p_last_error
  );

  -- Perform devices update only if stats/metadata changed or last_seen_at is older than 5 minutes
  UPDATE public.devices
  SET status = 'online',
      last_seen_at = now(),
      app_version = p_app_version,
      os_version = p_os_version,
      free_disk_bytes = p_free_disk_bytes,
      memory_class_mb = p_memory_class_mb,
      network_type = p_network_type,
      current_manifest_version = coalesce(p_manifest_version, current_manifest_version),
      last_error = p_last_error
  WHERE id = v_device.id
    AND (
      status IS DISTINCT FROM 'online'
      OR app_version IS DISTINCT FROM p_app_version
      OR os_version IS DISTINCT FROM p_os_version
      OR free_disk_bytes IS DISTINCT FROM p_free_disk_bytes
      OR memory_class_mb IS DISTINCT FROM p_memory_class_mb
      OR network_type IS DISTINCT FROM p_network_type
      OR current_manifest_version IS DISTINCT FROM coalesce(p_manifest_version, current_manifest_version)
      OR last_error IS DISTINCT FROM p_last_error
      OR last_seen_at IS NULL
      OR last_seen_at < now() - interval '5 minutes'
    );

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- 7. Update update_device_statuses status offline timing threshold to 10 minutes (matching 5-min throttle)
CREATE OR REPLACE FUNCTION public.update_device_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.devices
  SET status = CASE
    WHEN last_seen_at >= now() - interval '10 minutes' THEN 'online'
    ELSE 'offline'
  END
  WHERE team_id IS NOT NULL
    AND status <> CASE
      WHEN last_seen_at >= now() - interval '10 minutes' THEN 'online'
      ELSE 'offline'
    END;
END;
$$;
