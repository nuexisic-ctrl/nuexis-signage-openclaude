-- ============================================================
-- MIGRATION: Harden Playlist Security & Sync Correctness
-- Date: 2026-06-20
-- ============================================================

-- 1. Drop public.devices anonymous select policy to fix S-1
DROP POLICY IF EXISTS allow_anon_read_devices ON public.devices;

-- 2. Revoke execute on administrative/CMS RPCs from public and anon to fix S-2
REVOKE EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_playlist_atomic(uuid, text, uuid, jsonb, text, integer) FROM public, anon;

-- 3. Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_playlist_atomic(uuid, text, uuid, jsonb, text, integer) TO authenticated, service_role;

-- 4. Redefine create_playlist_atomic to enforce SET search_path = public to fix S-3
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
        CASE WHEN v_item->>'asset_id' IS NOT NULL AND v_item->>'asset_id' <> ''
             THEN (v_item->>'asset_id')::uuid
             ELSE NULL END,
        (v_item->>'duration_seconds')::integer,
        (v_item->>'sort_order')::integer,
        v_item->>'widget_type',
        CASE WHEN v_item->'widget_config' IS NOT NULL AND v_item->'widget_config' <> 'null'::jsonb
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

-- 5. Redefine update_playlist_atomic to:
--    - Set SET search_path = public (S-3)
--    - Check caller team membership (S-4)
--    - Implement optimistic concurrency check (expected_version)
--    - Diff items to keep stable item IDs (A2)
CREATE OR REPLACE FUNCTION public.update_playlist_atomic(
  p_playlist_id       uuid,
  p_name              text,
  p_team_id           uuid,
  p_items             jsonb,
  p_color             text DEFAULT NULL::text,
  p_expected_version  integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_playlist_team_id   uuid;
  v_current_version    integer;
  v_item               jsonb;
  v_item_id            uuid;
  v_item_type          text;
  v_asset_id           uuid;
  v_duration_seconds   integer;
  v_sort_order         integer;
  v_widget_type        text;
  v_widget_config      jsonb;
  v_processed_ids      uuid[] := '{}';
BEGIN
  -- 1. Verify the playlist exists and belongs to the specified team
  SELECT team_id, version INTO v_playlist_team_id, v_current_version
  FROM public.playlists
  WHERE id = p_playlist_id;

  IF v_playlist_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Playlist not found.');
  END IF;

  -- 2. Verify caller team membership (S-4)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND team_id = p_team_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: user does not belong to this team.');
  END IF;

  -- Validate caller team equals playlist team
  IF v_playlist_team_id != p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to modify this playlist.');
  END IF;

  -- 3. Optimistic concurrency control (expected_version)
  IF p_expected_version IS NOT NULL AND v_current_version IS DISTINCT FROM p_expected_version THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONCURRENCY_ERROR', 'message', 'This playlist has been modified by another user. Please reload the page.');
  END IF;

  -- 4. Diff updates for items to keep stable item IDs (A2)
  -- Loop through input items to insert or update
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_id := CASE WHEN v_item->>'id' IS NOT NULL AND v_item->>'id' <> '' AND v_item->>'id' NOT LIKE 'new-%'
                        THEN (v_item->>'id')::uuid
                        ELSE NULL END;
      v_item_type := v_item->>'type';
      v_asset_id := CASE WHEN v_item->>'asset_id' IS NOT NULL AND v_item->>'asset_id' <> ''
                         THEN (v_item->>'asset_id')::uuid
                         ELSE NULL END;
      v_duration_seconds := COALESCE((v_item->>'duration_seconds')::integer, 10);
      v_sort_order := (v_item->>'sort_order')::integer;
      v_widget_type := NULLIF(v_item->>'widget_type', '');
      v_widget_config := CASE WHEN v_item->'widget_config' IS NOT NULL AND v_item->'widget_config' <> 'null'::jsonb
                              THEN v_item->'widget_config'
                              ELSE NULL END;

      IF v_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.playlist_items WHERE id = v_item_id AND playlist_id = p_playlist_id) THEN
        -- Update existing item
        UPDATE public.playlist_items
        SET type = v_item_type,
            asset_id = v_asset_id,
            duration_seconds = v_duration_seconds,
            sort_order = v_sort_order,
            widget_type = v_widget_type,
            widget_config = v_widget_config
        WHERE id = v_item_id;
        
        v_processed_ids := array_append(v_processed_ids, v_item_id);
      ELSE
        -- Insert new item (generate new uuid)
        INSERT INTO public.playlist_items (
          playlist_id, type, asset_id, duration_seconds,
          sort_order, widget_type, widget_config
        ) VALUES (
          p_playlist_id, v_item_type, v_asset_id, v_duration_seconds,
          v_sort_order, v_widget_type, v_widget_config
        )
        RETURNING id INTO v_item_id;

        v_processed_ids := array_append(v_processed_ids, v_item_id);
      END IF;
    END LOOP;
  END IF;

  -- Delete items that were not present in the update payload
  DELETE FROM public.playlist_items
  WHERE playlist_id = p_playlist_id
    AND id NOT IN (SELECT unnest(v_processed_ids));

  -- 5. Update playlist header name, color, version and timestamp
  UPDATE public.playlists
  SET name = p_name,
      color = COALESCE(p_color, color),
      version = COALESCE(v_current_version, 0) + 1,
      updated_at = now()
  WHERE id = p_playlist_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
