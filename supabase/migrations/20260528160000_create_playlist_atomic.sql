-- ============================================================
-- Migration: Atomic playlist creation RPC
-- ============================================================
-- Wraps playlist header insert + items insert in a single Postgres
-- transaction. If items fail, the playlist header is rolled back too,
-- preventing ghost empty playlists from accumulating.

CREATE OR REPLACE FUNCTION public.create_playlist_atomic(
  p_team_id   uuid,
  p_name      text,
  p_items     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  -- Insert playlist header
  INSERT INTO public.playlists (team_id, name)
  VALUES (p_team_id, trim(p_name))
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

GRANT EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb) TO authenticated;
-- Explicitly deny anon to be safe
REVOKE EXECUTE ON FUNCTION public.create_playlist_atomic(uuid, text, jsonb) FROM anon;
