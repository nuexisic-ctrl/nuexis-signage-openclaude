-- ============================================================
-- MIGRATION: Fix All Supabase Security & Performance Advisories
-- Date: 2026-06-17
-- ============================================================

-- ============================================================
-- PART 1: Security — RLS Enabled No Policy on device_sessions
-- ============================================================
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_sessions_service_role ON public.device_sessions;
CREATE POLICY device_sessions_service_role ON public.device_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- PART 2: Security — Function Search Path Mutable (WARN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.url_encode_path(p_path text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.trigger_set_device_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.team_id IS DISTINCT FROM NEW.team_id OR
    OLD.content_type IS DISTINCT FROM NEW.content_type OR
    OLD.asset_id IS DISTINCT FROM NEW.asset_id OR
    OLD.playlist_id IS DISTINCT FROM NEW.playlist_id OR
    OLD.orientation IS DISTINCT FROM NEW.orientation OR
    OLD.scale_mode IS DISTINCT FROM NEW.scale_mode OR
    OLD.app_version IS DISTINCT FROM NEW.app_version OR
    OLD.os_version IS DISTINCT FROM NEW.os_version OR
    OLD.free_disk_bytes IS DISTINCT FROM NEW.free_disk_bytes OR
    OLD.memory_class_mb IS DISTINCT FROM NEW.memory_class_mb OR
    OLD.network_type IS DISTINCT FROM NEW.network_type OR
    OLD.last_error IS DISTINCT FROM NEW.last_error OR
    OLD.current_manifest_version IS DISTINCT FROM NEW.current_manifest_version
  ) THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- PART 3: Security — RLS Policy Always True on activity_log INSERT
-- ============================================================
DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );


-- ============================================================
-- PART 4: Security — Revoke remaining anon EXECUTE on internal functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_device_playtime_migration() FROM anon, authenticated;


-- ============================================================
-- PART 5: Performance — Add Missing FK Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_activity_log_team_id ON public.activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_device_health_events_team_id ON public.device_health_events(team_id);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_asset_id ON public.device_playback_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_team_id ON public.device_playback_events(team_id);
CREATE INDEX IF NOT EXISTS idx_devices_asset_id ON public.devices(asset_id);
CREATE INDEX IF NOT EXISTS idx_devices_playlist_id ON public.devices(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_asset_id ON public.playlist_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_playlists_team_id ON public.playlists(team_id);


-- ============================================================
-- PART 6: Performance — Fix Auth RLS InitPlan
-- ============================================================
DROP POLICY IF EXISTS "team can read widget edit logs" ON public.widget_edit_logs;
CREATE POLICY "team can read widget edit logs" ON public.widget_edit_logs
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

DROP POLICY IF EXISTS "team can read playback events" ON public.device_playback_events;
CREATE POLICY "team can read playback events" ON public.device_playback_events
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

DROP POLICY IF EXISTS "team can read health events" ON public.device_health_events;
CREATE POLICY "team can read health events" ON public.device_health_events
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));


-- ============================================================
-- PART 7: Performance — Drop Unused Indexes & Consolidate Multiple Permissive Policies
-- ============================================================

-- 7a: Drop Unused Indexes
DROP INDEX IF EXISTS public.idx_playlist_items_playlist_id;
DROP INDEX IF EXISTS public.idx_screen_groups_created_by;

-- 7b: Consolidate Multiple Permissive Policies
-- Devices Table
DROP POLICY IF EXISTS "team can read devices" ON public.devices;

-- Screen Groups Table
DROP POLICY IF EXISTS allow_anon_read_screen_groups ON public.screen_groups;
DROP POLICY IF EXISTS "team can read groups" ON public.screen_groups;
CREATE POLICY "team can read groups" ON public.screen_groups
  FOR SELECT TO anon, authenticated USING (true);

-- Screen Group Members Table
DROP POLICY IF EXISTS allow_anon_read_screen_group_members ON public.screen_group_members;
DROP POLICY IF EXISTS "team can read members" ON public.screen_group_members;
CREATE POLICY "team can read members" ON public.screen_group_members
  FOR SELECT TO anon, authenticated USING (true);
