-- ============================================================
-- MIGRATION: Backend Architecture & Security Remediation
-- Date: 2026-06-19
-- ============================================================

-- ── 1. RLS Policy Cleanups & Hardening on devices ───────────────────────────
DROP POLICY IF EXISTS allow_anon_read_devices ON public.devices;
DROP POLICY IF EXISTS devices_select_consolidated ON public.devices;
DROP POLICY IF EXISTS devices_select_device ON public.devices;
DROP POLICY IF EXISTS "team can read devices" ON public.devices;

CREATE POLICY "allow_anon_read_devices" ON public.devices
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow_authenticated_read_devices" ON public.devices
  FOR SELECT TO authenticated
  USING (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

-- ── 2. RLS Policy Hardening on screen_groups & members ─────────────────────
DROP POLICY IF EXISTS "team can read groups" ON public.screen_groups;
DROP POLICY IF EXISTS "team can read members" ON public.screen_group_members;

CREATE POLICY "team can read groups" ON public.screen_groups
  FOR SELECT TO authenticated
  USING (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

CREATE POLICY "team can read members" ON public.screen_group_members
  FOR SELECT TO authenticated
  USING (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

-- ── 3. Hardening get_player_device_state verification (A4) ──────────────────
CREATE OR REPLACE FUNCTION public.get_player_device_state(
  p_hardware_id text,
  p_secret text default null,
  p_app_version text default null,
  p_os_version text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_device public.devices;
  v_resolved public.devices;
BEGIN
  SELECT *
    INTO v_device
    FROM public.devices
    WHERE hardware_id = p_hardware_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_device.id IS NULL THEN
    RETURN null;
  END IF;

  -- Require valid secret if the device holds a secret (regardless of pairing status)
  IF NOT public.device_secret_matches(v_device, p_secret) THEN
    RETURN null;
  END IF;

  -- Resolve group inheritance/content
  v_resolved := public.resolve_device_state(v_device);

  RETURN to_jsonb(v_resolved) - 'secret' - 'device_secret_hash';
END;
$$;

-- ── 4. Storage Quota Enforcement Trigger (A7) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.check_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'storage'
AS $$
DECLARE
  v_team_id text;
  v_current_total bigint;
  v_quota bigint := 5368709120; -- 5GB total quota in bytes
BEGIN
  -- Get the team folder name (the first segment of the object path)
  v_team_id := (storage.foldername(NEW.name))[1];
  
  -- Calculate total size of existing objects in this team's folder
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    INTO v_current_total
    FROM storage.objects
    WHERE bucket_id = NEW.bucket_id
      AND (storage.foldername(name))[1] = v_team_id;
      
  -- Verify if adding the new object exceeds the quota
  IF v_current_total + COALESCE((NEW.metadata->>'size')::bigint, 0) > v_quota THEN
    RAISE EXCEPTION 'Storage quota exceeded. Team folder limit is 5GB.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_storage_quota ON storage.objects;
CREATE TRIGGER trg_check_storage_quota
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'workspace-media')
  EXECUTE FUNCTION public.check_storage_quota();

-- ── 5. Event Tables Range Partitioning & pg_cron Management (B1) ───────────
-- 5a. Rename existing event tables
ALTER TABLE public.device_health_events RENAME TO device_health_events_old;
ALTER TABLE public.device_playback_events RENAME TO device_playback_events_old;

-- 5b. Create partitioned parent tables (including created_at in primary keys)
CREATE TABLE public.device_health_events (
  id uuid DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  app_version text,
  os_version text,
  free_disk_bytes bigint,
  memory_class_mb integer,
  network_type text,
  manifest_version text,
  current_item_id uuid,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE public.device_playback_events (
  id uuid DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  item_id uuid,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  position_ms bigint NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  cache_status text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 5c. Create partition indexes
CREATE INDEX IF NOT EXISTS idx_device_health_events_device_created ON public.device_health_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_health_events_team_id ON public.device_health_events(team_id);

CREATE INDEX IF NOT EXISTS idx_device_playback_events_device_created ON public.device_playback_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_team_id ON public.device_playback_events(team_id);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_asset_id ON public.device_playback_events(asset_id);

-- 5d. Enable RLS and setup policies on partitioned tables
ALTER TABLE public.device_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_playback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can read health events" ON public.device_health_events
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

CREATE POLICY "team can read playback events" ON public.device_playback_events
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

CREATE POLICY "service_role_all_health" ON public.device_health_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_playback" ON public.device_playback_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.device_playback_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.device_health_events FROM anon, authenticated;
GRANT SELECT ON public.device_playback_events TO authenticated;
GRANT SELECT ON public.device_health_events TO authenticated;

-- 5e. Create daily partitions builder and sweeper (14 days retention)
CREATE OR REPLACE FUNCTION public.manage_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_part_date date;
  v_part_name text;
  v_start_str text;
  v_end_str text;
  v_sql text;
  v_drop_name text;
BEGIN
  -- Create partitions for the past 7 days and next 3 days (today, tomorrow, day after)
  -- This accommodates historical data copy and future writes.
  FOR i IN -7..3 LOOP
    v_part_date := (now() + (i || ' days')::interval)::date;
    v_start_str := to_char(v_part_date, 'YYYY-MM-DD');
    v_end_str := to_char(v_part_date + 1, 'YYYY-MM-DD');
    
    -- Health events partition
    v_part_name := 'device_health_events_y' || to_char(v_part_date, 'YYYYmMMdDD');
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.device_health_events ' ||
      'FOR VALUES FROM (%L) TO (%L);',
      v_part_name, v_start_str || ' 00:00:00+00', v_end_str || ' 00:00:00+00'
    );
    EXECUTE v_sql;
    
    -- Playback events partition
    v_part_name := 'device_playback_events_y' || to_char(v_part_date, 'YYYYmMMdDD');
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.device_playback_events ' ||
      'FOR VALUES FROM (%L) TO (%L);',
      v_part_name, v_start_str || ' 00:00:00+00', v_end_str || ' 00:00:00+00'
    );
    EXECUTE v_sql;
  END LOOP;

  -- Drop partitions older than 14 days
  FOR i IN 14..30 LOOP
    v_part_date := (now() - (i || ' days')::interval)::date;
    
    -- Health events partition
    v_drop_name := 'device_health_events_y' || to_char(v_part_date, 'YYYYmMMdDD');
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = v_drop_name
    ) THEN
      EXECUTE format('DROP TABLE public.%I;', v_drop_name);
    END IF;
    
    -- Playback events partition
    v_drop_name := 'device_playback_events_y' || to_char(v_part_date, 'YYYYmMMdDD');
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = v_drop_name
    ) THEN
      EXECUTE format('DROP TABLE public.%I;', v_drop_name);
    END IF;
  END LOOP;
END;
$$;

-- 5f. Bootstrap partitions
SELECT public.manage_partitions();

-- 5g. Migrate old data
INSERT INTO public.device_health_events (id, device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb, network_type, manifest_version, current_item_id, last_error, created_at)
SELECT id, device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb, network_type, manifest_version, current_item_id, last_error, created_at
FROM public.device_health_events_old;

-- Drop old tables
DROP TABLE public.device_health_events_old;
DROP TABLE public.device_playback_events_old;

-- 5h. Schedule partition management and heartbeat offline sweeper via pg_cron
SELECT cron.unschedule('manage-partitions-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manage-partitions-job');
SELECT cron.schedule('manage-partitions-job', '0 0 * * *', $$SELECT public.manage_partitions()$$);

SELECT cron.unschedule('mark-offline-devices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-offline-devices');
SELECT cron.schedule('mark-offline-devices', '*/2 * * * *', $$SELECT public.update_device_statuses()$$);

-- ── 6. Write-Time Precomputed Manifest Hashing (B2) ─────────────────────────
-- 6a. BEFORE Trigger on devices table to precompute current_manifest_version
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
          ) END
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

DROP TRIGGER IF EXISTS trg_precompute_manifest_version ON public.devices;
CREATE TRIGGER trg_precompute_manifest_version
  BEFORE INSERT OR UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_precompute_manifest_version();

-- 6b. Optimize get_player_manifest to utilize precalculated column
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
        ) END
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

-- Drop redundant trigger since precomputation is now done BEFORE update
DROP TRIGGER IF EXISTS trigger_device_updated_at ON public.devices;

-- ── 7. Missing FK Indexes (B3) ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_screen_groups_created_by ON public.screen_groups(created_by);

-- ── 8. Content-Side Push Triggers to Realtime channels (B4) ──────────────────
CREATE OR REPLACE FUNCTION public.notify_devices_for_playlist(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Notify devices assigned to playlist directly or via screen groups
  UPDATE public.devices
     SET updated_at = now()
   WHERE playlist_id = p_playlist_id
      OR id IN (
        SELECT sgm.device_id
        FROM public.screen_group_members sgm
        JOIN public.screen_groups sg ON sg.id = sgm.group_id
        WHERE sg.playlist_id = p_playlist_id
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_devices_for_asset(p_asset_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Notify devices using the asset directly, via group, or via playlist items
  UPDATE public.devices
     SET updated_at = now()
   WHERE asset_id = p_asset_id
      OR id IN (
        SELECT sgm.device_id
        FROM public.screen_group_members sgm
        JOIN public.screen_groups sg ON sg.id = sgm.group_id
        WHERE sg.asset_id = p_asset_id
      )
      OR playlist_id IN (
        SELECT playlist_id FROM public.playlist_items WHERE asset_id = p_asset_id
      )
      OR id IN (
        SELECT sgm.device_id
        FROM public.screen_group_members sgm
        JOIN public.screen_groups sg ON sg.id = sgm.group_id
        JOIN public.playlist_items pi ON pi.playlist_id = sg.playlist_id
        WHERE pi.asset_id = p_asset_id
      );
END;
$$;

-- Triggers for playlist changes
CREATE OR REPLACE FUNCTION public.trg_fn_on_playlist_update()
RETURNS trigger AS $$
BEGIN
  PERFORM public.notify_devices_for_playlist(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_playlist_update ON public.playlists;
CREATE TRIGGER trg_playlist_update
  AFTER UPDATE OF name ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_on_playlist_update();

-- Triggers for playlist_items changes
CREATE OR REPLACE FUNCTION public.trg_fn_on_playlist_item_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.notify_devices_for_playlist(OLD.playlist_id);
    RETURN OLD;
  ELSE
    PERFORM public.notify_devices_for_playlist(NEW.playlist_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_playlist_item_change ON public.playlist_items;
CREATE TRIGGER trg_playlist_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.playlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_on_playlist_item_change();

-- Triggers for asset updates
CREATE OR REPLACE FUNCTION public.trg_fn_on_asset_update()
RETURNS trigger AS $$
BEGIN
  PERFORM public.notify_devices_for_asset(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_update ON public.assets;
CREATE TRIGGER trg_asset_update
  AFTER UPDATE OF file_path, mime_type ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_on_asset_update();

-- Update on_screen_group_change to update device updated_at (not just last_seen_at)
CREATE OR REPLACE FUNCTION public.on_screen_group_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.devices
     SET updated_at = now()
   WHERE id IN (
     SELECT device_id 
     from public.screen_group_members 
     where group_id = NEW.id
   );
  RETURN NEW;
END;
$$;

-- ── 9. Automated Database Audit Logging (A6) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id uuid;
  v_device_id uuid := null;
  v_event_type text;
  v_description text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'devices' THEN
    IF TG_OP = 'DELETE' THEN
      v_team_id := OLD.team_id;
      v_device_id := OLD.id;
      v_description := 'Device deleted: ' || COALESCE(OLD.name, OLD.hardware_id);
    ELSE
      v_team_id := NEW.team_id;
      v_device_id := NEW.id;
      IF TG_OP = 'INSERT' THEN
        v_description := 'Device registered: ' || COALESCE(NEW.name, NEW.hardware_id);
      ELSE
        IF OLD.team_id IS NULL AND NEW.team_id IS NOT NULL THEN
          v_description := 'Device paired: ' || COALESCE(NEW.name, NEW.hardware_id);
        ELSIF OLD.team_id IS NOT NULL AND NEW.team_id IS NULL THEN
          v_description := 'Device unpaired: ' || COALESCE(OLD.name, OLD.hardware_id);
        ELSE
          v_description := 'Device updated: ' || COALESCE(NEW.name, NEW.hardware_id);
        END IF;
      END IF;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'assets' THEN
    IF TG_OP = 'DELETE' THEN
      v_team_id := OLD.team_id;
      v_description := 'Asset deleted: ' || OLD.file_name;
      v_metadata := jsonb_build_object('file_path', OLD.file_path, 'mime_type', OLD.mime_type);
    ELSE
      v_team_id := NEW.team_id;
      v_metadata := jsonb_build_object('file_path', NEW.file_path, 'mime_type', NEW.mime_type);
      IF TG_OP = 'INSERT' THEN
        v_description := 'Asset uploaded: ' || NEW.file_name;
      ELSE
        v_description := 'Asset updated: ' || NEW.file_name;
      END IF;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'playlists' THEN
    IF TG_OP = 'DELETE' THEN
      v_team_id := OLD.team_id;
      v_description := 'Playlist deleted: ' || OLD.name;
    ELSE
      v_team_id := NEW.team_id;
      IF TG_OP = 'INSERT' THEN
        v_description := 'Playlist created: ' || NEW.name;
      ELSE
        v_description := 'Playlist updated: ' || NEW.name;
      END IF;
    END IF;
  END IF;

  v_event_type := TG_TABLE_NAME || '_' || LOWER(TG_OP);

  IF v_team_id IS NOT NULL THEN
    INSERT INTO public.activity_log (team_id, device_id, event_type, description, metadata)
    VALUES (v_team_id, v_device_id, v_event_type, v_description, v_metadata);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devices_activity ON public.devices;
CREATE TRIGGER trg_devices_activity
  AFTER INSERT OR UPDATE OF team_id, name OR DELETE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

DROP TRIGGER IF EXISTS trg_assets_activity ON public.assets;
CREATE TRIGGER trg_assets_activity
  AFTER INSERT OR UPDATE OF file_name, file_path OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

DROP TRIGGER IF EXISTS trg_playlists_activity ON public.playlists;
CREATE TRIGGER trg_playlists_activity
  AFTER INSERT OR UPDATE OF name OR DELETE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

-- ── 10. Restrict Routine Execution Privileges (A2) ──────────────────────────
-- Revoke execution from public role (which stops anon and authenticated by default)
REVOKE EXECUTE ON FUNCTION public.handle_device_playtime_migration() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_device_statuses() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_device_state(public.devices) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.device_secret_matches(public.devices, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_device_session(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_device_session_token(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_precompute_manifest_version() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_screen_group_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_screen_group_member_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_asset_name() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_device_name() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_playlist_name() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_team_name() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_name(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_profile_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_anon_heartbeat_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_storage_quota() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manage_partitions() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_table_activity() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_devices_for_playlist(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_devices_for_asset(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_on_playlist_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_on_playlist_item_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_on_asset_update() FROM public, anon, authenticated;
