-- Migration: Hardening playlist system security, sync and performance

-- 1. Drop anonymous SELECT policy on devices table
DROP POLICY IF EXISTS allow_anon_read_devices ON public.devices;

-- 2. Add version column to playlists table for optimistic concurrency
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

-- 3. Harden create_playlist_atomic with explicit SET search_path = public and revoke/grant privileges
CREATE OR REPLACE FUNCTION public.create_playlist_atomic(
  p_team_id   uuid,
  p_name      text,
  p_items     jsonb,
  p_color     text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_playlist_id uuid;
  v_item        jsonb;
BEGIN
  -- Validate inputs
  IF p_team_id IS NULL THEN
    RAISE EXCEPTION 'Team ID is required';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Playlist name is required';
  END IF;

  -- Verify the calling user belongs to the team
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND team_id = p_team_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to this team';
  END IF;

  -- Insert playlist header (version defaults to 0)
  INSERT INTO public.playlists (team_id, name, color, version)
  VALUES (p_team_id, trim(p_name), p_color, 0)
  RETURNING id INTO v_playlist_id;

  -- Insert items (if any) — all in the same transaction
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.playlist_items (
        playlist_id,
        type,
        asset_id,
        duration_seconds,
        sort_order,
        widget_type,
        widget_config
      ) VALUES (
        v_playlist_id,
        v_item->>'type',
        CASE WHEN v_item->>'asset_id' IS NOT NULL
             THEN (v_item->>'asset_id')::uuid
             ELSE NULL END,
        (v_item->>'duration_seconds')::integer,
        (v_item->>'sort_order')::integer,
        v_item->>'widget_type',
        CASE WHEN v_item->'widget_config' IS NOT NULL
             THEN v_item->'widget_config'
             ELSE NULL END
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_playlist_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Explicitly revoke/grant execute on create_playlist_atomic
REVOKE EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb, text) TO authenticated, service_role;

-- 4. Harden and improve update_playlist_atomic
-- Drop the old function first to prevent signature mismatch / overloading
DROP FUNCTION IF EXISTS public.update_playlist_atomic(uuid, text, uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.update_playlist_atomic(
  p_playlist_id         uuid,
  p_name                text,
  p_team_id             uuid,
  p_items               jsonb,
  p_color               text DEFAULT NULL::text,
  p_expected_version    integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_playlist_team_id uuid;
  v_current_version  integer;
  v_item             jsonb;
  v_item_id          uuid;
  v_index            integer := 0;
BEGIN
  -- Verify the calling user belongs to the team
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND team_id = p_team_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: user does not belong to this team');
  END IF;

  -- 1. Retrieve current team and version of the playlist
  SELECT team_id, version INTO v_playlist_team_id, v_current_version
  FROM public.playlists
  WHERE id = p_playlist_id;

  IF v_playlist_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Playlist not found.');
  END IF;

  IF v_playlist_team_id != p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to modify this playlist.');
  END IF;

  -- 2. Verify expected version if provided (optimistic concurrency control)
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'concurrency_conflict',
      'message', 'This playlist has been modified by another user. Please reload the page to get the latest changes.'
    );
  END IF;

  -- 3. Delete existing items that are NOT present in the incoming payload (using incoming item IDs)
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    DELETE FROM public.playlist_items WHERE playlist_id = p_playlist_id;
  ELSE
    DELETE FROM public.playlist_items
    WHERE playlist_id = p_playlist_id
      AND id NOT IN (
        SELECT (val->>'id')::uuid
        FROM jsonb_array_elements(p_items) AS val
        WHERE val->>'id' IS NOT NULL AND val->>'id' != ''
      );
  END IF;

  -- 4. Diff update and insert new items, preserving sorting order and keeping identity
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_id := CASE WHEN v_item->>'id' IS NOT NULL AND v_item->>'id' != '' THEN (v_item->>'id')::uuid ELSE NULL END;

      IF v_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.playlist_items WHERE id = v_item_id AND playlist_id = p_playlist_id) THEN
        -- Update existing item (preserving created_at)
        UPDATE public.playlist_items
        SET type = v_item->>'type',
            asset_id = CASE WHEN v_item->>'asset_id' IS NOT NULL AND v_item->>'asset_id' != '' THEN (v_item->>'asset_id')::uuid ELSE NULL END,
            duration_seconds = COALESCE((v_item->>'duration_seconds')::integer, 10),
            sort_order = v_index,
            widget_type = NULLIF(v_item->>'widget_type', ''),
            widget_config = CASE WHEN v_item->'widget_config' = 'null'::jsonb OR v_item->'widget_config' IS NULL THEN NULL ELSE v_item->'widget_config' END
        WHERE id = v_item_id AND playlist_id = p_playlist_id;
      ELSE
        -- Insert new item
        INSERT INTO public.playlist_items (
          playlist_id, type, asset_id, duration_seconds,
          sort_order, widget_type, widget_config
        ) VALUES (
          p_playlist_id,
          v_item->>'type',
          CASE WHEN v_item->>'asset_id' IS NOT NULL AND v_item->>'asset_id' != '' THEN (v_item->>'asset_id')::uuid ELSE NULL END,
          COALESCE((v_item->>'duration_seconds')::integer, 10),
          v_index,
          NULLIF(v_item->>'widget_type', ''),
          CASE WHEN v_item->'widget_config' = 'null'::jsonb OR v_item->'widget_config' IS NULL THEN NULL ELSE v_item->'widget_config' END
        );
      END IF;
      v_index := v_index + 1;
    END LOOP;
  END IF;

  -- 5. Update playlist details, incrementing version
  UPDATE public.playlists
  SET name = trim(p_name),
      color = COALESCE(p_color, color),
      version = version + 1,
      updated_at = now()
  WHERE id = p_playlist_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Explicitly revoke/grant execute on update_playlist_atomic
REVOKE EXECUTE ON FUNCTION public.update_playlist_atomic(uuid, text, uuid, jsonb, text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_playlist_atomic(uuid, text, uuid, jsonb, text, integer) TO authenticated, service_role;

-- 5. Create playlist summary RPC
CREATE OR REPLACE FUNCTION public.get_playlist_summary(p_playlist_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_items', count(*)::integer,
    'total_duration_seconds', coalesce(sum(pi.duration_seconds), 0)::integer,
    'total_size_bytes', coalesce(sum(a.size_bytes), 0)::bigint
  )
  FROM public.playlist_items pi
  LEFT JOIN public.assets a ON a.id = pi.asset_id
  WHERE pi.playlist_id = p_playlist_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_playlist_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_playlist_summary(uuid) TO authenticated, service_role;
