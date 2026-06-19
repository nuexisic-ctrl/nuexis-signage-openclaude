-- ============================================================
-- MIGRATION: Advisor Lint Remediation
-- Date: 2026-06-19
-- ============================================================

-- ── 1. Revoke Executable Privileges on Security Definer RPCs ──
-- Revoke execution from public/anon on create_playlist_atomic (it must only be executed by authenticated/service_role)
REVOKE EXECUTE ON FUNCTION public.create_playlist_atomic(p_team_id uuid, p_name text, p_items jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_playlist_atomic(p_team_id uuid, p_name text, p_items jsonb) TO authenticated, service_role;

-- Revoke execution from public/anon/authenticated on trigger_set_device_updated_at (it is an internal trigger function)
REVOKE EXECUTE ON FUNCTION public.trigger_set_device_updated_at() FROM public, anon, authenticated;

-- ── 2. Redefine manage_partitions to create policies on child tables ──
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
  -- Create partitions for the past 7 days and next 3 days
  FOR i IN -7..3 LOOP
    v_part_date := (now() + (i || ' days')::interval)::date;
    v_start_str := to_char(v_part_date, 'YYYY-MM-DD');
    v_end_str := to_char(v_part_date + 1, 'YYYY-MM-DD');
    
    -- Health events partition
    v_part_name := 'device_health_events_y' || to_char(v_part_date, 'YYYY_MM_DD');
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.device_health_events ' ||
      'FOR VALUES FROM (%L) TO (%L);',
      v_part_name, v_start_str || ' 00:00:00+00', v_end_str || ' 00:00:00+00'
    );
    EXECUTE v_sql;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_part_name);
    
    -- Drop and create policies on the child partition
    EXECUTE format('DROP POLICY IF EXISTS "team can read" ON public.%I;', v_part_name);
    EXECUTE format('CREATE POLICY "team can read" ON public.%I FOR SELECT TO authenticated USING (team_id = (((SELECT auth.jwt()) -> ''app_metadata'' ->> ''team_id'')::uuid));', v_part_name);
    
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I;', v_part_name);
    EXECUTE format('CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', v_part_name);
    
    -- Playback events partition
    v_part_name := 'device_playback_events_y' || to_char(v_part_date, 'YYYY_MM_DD');
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.device_playback_events ' ||
      'FOR VALUES FROM (%L) TO (%L);',
      v_part_name, v_start_str || ' 00:00:00+00', v_end_str || ' 00:00:00+00'
    );
    EXECUTE v_sql;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_part_name);
    
    -- Drop and create policies on the child partition
    EXECUTE format('DROP POLICY IF EXISTS "team can read" ON public.%I;', v_part_name);
    EXECUTE format('CREATE POLICY "team can read" ON public.%I FOR SELECT TO authenticated USING (team_id = (((SELECT auth.jwt()) -> ''app_metadata'' ->> ''team_id'')::uuid));', v_part_name);
    
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I;', v_part_name);
    EXECUTE format('CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', v_part_name);
  END LOOP;

  -- Drop partitions older than 14 days
  FOR i IN 14..30 LOOP
    v_part_date := (now() - (i || ' days')::interval)::date;
    
    -- Health events partition
    v_drop_name := 'device_health_events_y' || to_char(v_part_date, 'YYYY_MM_DD');
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = v_drop_name
    ) THEN
      EXECUTE format('DROP TABLE public.%I;', v_drop_name);
    END IF;
    
    -- Playback events partition
    v_drop_name := 'device_playback_events_y' || to_char(v_part_date, 'YYYY_MM_DD');
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = v_drop_name
    ) THEN
      EXECUTE format('DROP TABLE public.%I;', v_drop_name);
    END IF;
  END LOOP;
END;
$$;

-- Apply policies to existing partitions by re-running manage_partitions()
SELECT public.manage_partitions();

-- ── 3. Optimize auth_rls_initplan in devices, screen_groups, screen_group_members ──
-- public.devices policy
DROP POLICY IF EXISTS "allow_authenticated_read_devices" ON public.devices;
CREATE POLICY "allow_authenticated_read_devices" ON public.devices
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

-- public.screen_groups policy
DROP POLICY IF EXISTS "team can read groups" ON public.screen_groups;
CREATE POLICY "team can read groups" ON public.screen_groups
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

-- public.screen_group_members policy
DROP POLICY IF EXISTS "team can read members" ON public.screen_group_members;
CREATE POLICY "team can read members" ON public.screen_group_members
  FOR SELECT TO authenticated
  USING (team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id')::uuid));

-- ── 4. Fix multiple_permissive_policies by splitting FOR ALL into non-overlapping commands ──
-- Split screen_groups "owners can write groups" FOR ALL into INSERT, UPDATE, DELETE policies
DROP POLICY IF EXISTS "owners can write groups" ON public.screen_groups;

CREATE POLICY "owners insert groups" ON public.screen_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

CREATE POLICY "owners update groups" ON public.screen_groups
  FOR UPDATE TO authenticated
  USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  )
  WITH CHECK (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

CREATE POLICY "owners delete groups" ON public.screen_groups
  FOR DELETE TO authenticated
  USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

-- Split screen_group_members "owners can write members" FOR ALL into INSERT, UPDATE, DELETE policies
DROP POLICY IF EXISTS "owners can write members" ON public.screen_group_members;

CREATE POLICY "owners insert members" ON public.screen_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

CREATE POLICY "owners update members" ON public.screen_group_members
  FOR UPDATE TO authenticated
  USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  )
  WITH CHECK (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

CREATE POLICY "owners delete members" ON public.screen_group_members
  FOR DELETE TO authenticated
  USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );
