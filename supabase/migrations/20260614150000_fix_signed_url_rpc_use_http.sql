-- ============================================================
-- Migration: Fix get_player_signed_media_url RPC functions
-- ============================================================
-- Both get_player_signed_media_url and get_player_signed_media_url_by_session
-- were calling storage.create_signed_url() which does NOT exist as a
-- PostgreSQL function in hosted Supabase. This migration rewrites them to
-- use the HTTP extension to call the Supabase Storage REST API instead.
--
-- Additionally fixes:
-- - URL encoding for file paths with spaces/special chars
-- - Widget config passthrough (JSON stored in file_path)
--
-- Prerequisites stored in vault.secrets:
--   - 'service_role_key' : the project's service-role JWT
--   - 'supabase_url'     : the project's public API URL

-- ── 1. Enable http extension ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ── 2. URL encoding helper ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.url_encode_path(p_path text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts text[];
  v_result text;
  v_i int;
BEGIN
  -- Split path by '/' and encode each segment individually
  v_parts := string_to_array(p_path, '/');
  v_result := '';
  FOR v_i IN 1..array_length(v_parts, 1) LOOP
    IF v_i > 1 THEN
      v_result := v_result || '/';
    END IF;
    -- Replace spaces and special chars with percent-encoded equivalents
    v_result := v_result || replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(v_parts[v_i], '%', '%25'),
                  ' ', '%20'),
                '#', '%23'),
              '?', '%3F'),
            '&', '%26'),
          '+', '%2B'),
        '@', '%40'),
      '''', '%27');
  END LOOP;
  RETURN v_result;
END;
$$;

-- ── 3. Rewrite get_player_signed_media_url (used by Android player) ─────────
CREATE OR REPLACE FUNCTION public.get_player_signed_media_url(
  p_hardware_id text,
  p_secret text,
  p_file_path text,
  p_expires_in numeric DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_bucket text := 'workspace-media';
  v_service_key text;
  v_base_url text;
  v_response extensions.http_response;
  v_signed_url text;
  v_response_json jsonb;
  v_encoded_path text;
BEGIN
  -- Validate file path
  IF p_file_path IS NULL OR length(trim(p_file_path)) = 0 THEN
    RAISE EXCEPTION 'file path required';
  END IF;

  -- Pass through external URLs
  IF p_file_path LIKE 'http://%' OR p_file_path LIKE 'https://%' THEN
    RETURN p_file_path;
  END IF;

  -- Skip widget configs (JSON stored in file_path column)
  IF p_file_path LIKE '{%' THEN
    RETURN p_file_path;
  END IF;

  -- Authenticate device
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

  -- Validate file path belongs to device's team
  IF NOT p_file_path LIKE v_device.team_id::text || '/%' THEN
    RAISE EXCEPTION 'Unauthorized file path';
  END IF;

  -- Get secrets from vault
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  SELECT decrypted_secret INTO v_base_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;

  IF v_service_key IS NULL OR v_base_url IS NULL THEN
    RAISE EXCEPTION 'Storage configuration missing';
  END IF;

  -- URL-encode the file path segments to handle spaces and special chars
  v_encoded_path := public.url_encode_path(p_file_path);

  -- Call Storage API to create signed URL
  SELECT * INTO v_response FROM extensions.http(
    (
      'POST',
      v_base_url || '/storage/v1/object/sign/' || v_bucket || '/' || v_encoded_path,
      ARRAY[
        extensions.http_header('apikey', v_service_key),
        extensions.http_header('Authorization', 'Bearer ' || v_service_key)
      ],
      'application/json',
      '{"expiresIn": ' || p_expires_in::integer::text || '}'
    )::extensions.http_request
  );

  IF v_response.status != 200 THEN
    RAISE EXCEPTION 'Failed to generate signed URL: status %, body: %', v_response.status, left(v_response.content, 200);
  END IF;

  -- Parse response to get signedURL
  v_response_json := v_response.content::jsonb;
  v_signed_url := v_response_json->>'signedURL';

  IF v_signed_url IS NULL THEN
    RAISE EXCEPTION 'Failed to generate signed URL: no signedURL in response';
  END IF;

  -- The Storage API returns a relative path, prepend the base URL
  IF v_signed_url NOT LIKE 'http%' THEN
    v_signed_url := v_base_url || '/storage/v1' || v_signed_url;
  END IF;

  RETURN v_signed_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_signed_media_url(text, text, text, numeric)
  TO anon, authenticated;

-- ── 4. Rewrite get_player_signed_media_url_by_session (used by web API) ─────
CREATE OR REPLACE FUNCTION public.get_player_signed_media_url_by_session(
  p_device_id uuid,
  p_session_token text,
  p_file_path text,
  p_expires_in integer DEFAULT 3600
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_bucket text := 'workspace-media';
  v_service_key text;
  v_base_url text;
  v_response extensions.http_response;
  v_signed_url text;
  v_response_json jsonb;
  v_encoded_path text;
BEGIN
  -- Validate file path
  IF p_file_path IS NULL OR length(trim(p_file_path)) = 0 THEN
    RAISE EXCEPTION 'file path required';
  END IF;

  -- Pass through external URLs
  IF p_file_path LIKE 'http://%' OR p_file_path LIKE 'https://%' THEN
    RETURN p_file_path;
  END IF;

  -- Skip widget configs (JSON stored in file_path column)
  IF p_file_path LIKE '{%' THEN
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

  -- Get secrets from vault
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  SELECT decrypted_secret INTO v_base_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;

  IF v_service_key IS NULL OR v_base_url IS NULL THEN
    RAISE EXCEPTION 'Storage configuration missing';
  END IF;

  -- URL-encode the file path segments to handle spaces and special chars
  v_encoded_path := public.url_encode_path(p_file_path);

  -- Call Storage API to create signed URL
  SELECT * INTO v_response FROM extensions.http(
    (
      'POST',
      v_base_url || '/storage/v1/object/sign/' || v_bucket || '/' || v_encoded_path,
      ARRAY[
        extensions.http_header('apikey', v_service_key),
        extensions.http_header('Authorization', 'Bearer ' || v_service_key)
      ],
      'application/json',
      '{"expiresIn": ' || p_expires_in::text || '}'
    )::extensions.http_request
  );

  IF v_response.status != 200 THEN
    RAISE EXCEPTION 'Failed to generate signed URL: status %, body: %', v_response.status, left(v_response.content, 200);
  END IF;

  -- Parse response to get signedURL
  v_response_json := v_response.content::jsonb;
  v_signed_url := v_response_json->>'signedURL';

  IF v_signed_url IS NULL THEN
    RAISE EXCEPTION 'Failed to generate signed URL: no signedURL in response';
  END IF;

  -- The Storage API returns a relative path, prepend the base URL
  IF v_signed_url NOT LIKE 'http%' THEN
    v_signed_url := v_base_url || '/storage/v1' || v_signed_url;
  END IF;

  RETURN v_signed_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_signed_media_url_by_session(uuid, text, text, integer)
  TO anon, authenticated;
