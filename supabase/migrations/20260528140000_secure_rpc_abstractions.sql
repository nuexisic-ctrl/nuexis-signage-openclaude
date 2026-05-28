-- RPC functions to eliminate client-facing service-role key usage

-- 1. Check if a team slug is available for signup
CREATE OR REPLACE FUNCTION public.check_team_slug_available(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.teams WHERE slug = lower(p_slug)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_team_slug_available(text) TO anon, authenticated;

-- 2. Check if a team slug exists for login page verification
CREATE OR REPLACE FUNCTION public.check_team_exists(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams WHERE slug = lower(p_slug)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_team_exists(text) TO anon, authenticated;

-- 3. Query details of a player-owned asset securely
CREATE OR REPLACE FUNCTION public.get_player_asset(
  p_hardware_id text,
  p_secret text,
  p_asset_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_device public.devices;
  v_asset public.assets;
BEGIN
  SELECT *
    INTO v_device
    FROM public.devices
    WHERE hardware_id = p_hardware_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_device.id IS NULL
     OR v_device.team_id IS NULL
     OR NOT public.device_secret_matches(v_device, p_secret) THEN
    RAISE EXCEPTION 'Unauthorized device';
  END IF;

  SELECT *
    INTO v_asset
    FROM public.assets
    WHERE id = p_asset_id;

  IF v_asset.id IS NULL OR v_asset.team_id IS DISTINCT FROM v_device.team_id THEN
    RAISE EXCEPTION 'Unauthorized asset access';
  END IF;

  RETURN jsonb_build_object(
    'file_path', v_asset.file_path,
    'mime_type', v_asset.mime_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_asset(text, text, uuid) TO anon, authenticated;

-- 4. Generate signed URLs for active device sessions
CREATE OR REPLACE FUNCTION public.get_player_signed_media_url_by_session(
  p_device_id uuid,
  p_session_token text,
  p_file_path text,
  p_expires_in integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'storage'
AS $$
DECLARE
  v_device_json jsonb;
  v_team_id text;
  v_bucket text := 'workspace-media';
  v_signed record;
BEGIN
  IF p_file_path IS NULL OR length(trim(p_file_path)) = 0 THEN
    RAISE EXCEPTION 'File path is required';
  END IF;

  v_device_json := public.validate_device_session(p_device_id, p_session_token);
  IF v_device_json IS NULL THEN
    RAISE EXCEPTION 'Unauthorized device session';
  END IF;

  v_team_id := v_device_json ->> 'team_id';
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine team';
  END IF;

  IF NOT p_file_path LIKE v_team_id || '/%' THEN
    RAISE EXCEPTION 'Unauthorized file path';
  END IF;

  SELECT * INTO v_signed
    FROM storage.create_signed_url(v_bucket, p_file_path, p_expires_in);

  IF v_signed.signed_url IS NULL THEN
    RAISE EXCEPTION 'Failed to generate signed URL';
  END IF;

  RETURN v_signed.signed_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_signed_media_url_by_session(uuid, text, text, integer) TO anon, authenticated;
