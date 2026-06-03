-- ============================================================
-- MIGRATION: Fix Supabase performance and security advisories
-- Applied: 2026-06-03
-- ============================================================

-- ============================================================
-- PART 1: SECURITY — revoke anon/authenticated EXECUTE from
-- internal trigger and helper functions that must NOT be
-- callable via the REST API.
-- Player-facing functions (get_player_*, register_player_device,
-- etc.) intentionally retain anon access — they are used by
-- unauthenticated player devices and are self-authenticating
-- via hardware_id + secret.
-- ============================================================

-- Trigger functions (never called by REST clients)
REVOKE EXECUTE ON FUNCTION public.on_screen_group_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_screen_group_member_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_asset_name() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_device_name() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_name(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_playlist_name() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_team_name() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_profile_update() FROM anon, authenticated;

-- Internal helpers only called from other SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.device_secret_matches(public.devices, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_device_state(public.devices) FROM anon, authenticated;

-- Cron-only function, not a public RPC
REVOKE EXECUTE ON FUNCTION public.update_device_statuses() FROM anon, authenticated;


-- ============================================================
-- PART 2: PERFORMANCE — Fix auth_rls_initplan warnings
-- Replace bare auth.uid() / auth.jwt() with (SELECT auth.uid())
-- so Postgres evaluates them once per query, not per row.
-- Also consolidates multiple permissive SELECT policies into
-- one to fix the multiple_permissive_policies warnings.
-- ============================================================

-- activity_log
DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
DROP POLICY IF EXISTS activity_log_select ON public.activity_log;

CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY activity_log_select ON public.activity_log
  FOR SELECT USING (
    team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  );

-- screen_groups: merged two SELECT policies → one; fixed initplan
DROP POLICY IF EXISTS "owners can write groups" ON public.screen_groups;
DROP POLICY IF EXISTS "team can read groups" ON public.screen_groups;

CREATE POLICY "team can read groups" ON public.screen_groups
  FOR SELECT USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
  );

CREATE POLICY "owners can write groups" ON public.screen_groups
  FOR ALL USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );

-- screen_group_members: same treatment
DROP POLICY IF EXISTS "owners can write members" ON public.screen_group_members;
DROP POLICY IF EXISTS "team can read members" ON public.screen_group_members;

CREATE POLICY "team can read members" ON public.screen_group_members
  FOR SELECT USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
  );

CREATE POLICY "owners can write members" ON public.screen_group_members
  FOR ALL USING (
    team_id = (((SELECT auth.jwt()) -> 'app_metadata' ->> 'team_id'))::uuid
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND lower(p.role) = 'owner'
    )
  );


-- ============================================================
-- PART 3: PERFORMANCE — Add missing FK indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_device_id
  ON public.activity_log (device_id);

CREATE INDEX IF NOT EXISTS idx_screen_groups_asset_id
  ON public.screen_groups (asset_id);

CREATE INDEX IF NOT EXISTS idx_screen_groups_created_by
  ON public.screen_groups (created_by);

CREATE INDEX IF NOT EXISTS idx_screen_groups_playlist_id
  ON public.screen_groups (playlist_id);


-- ============================================================
-- PART 4: PERFORMANCE — Drop unused indexes
-- ============================================================

DROP INDEX IF EXISTS public.devices_team_last_seen_idx;
DROP INDEX IF EXISTS public.idx_devices_playlist_id;
DROP INDEX IF EXISTS public.idx_devices_asset_id;
DROP INDEX IF EXISTS public.idx_devices_team_status;
DROP INDEX IF EXISTS public.idx_profiles_team_id;
DROP INDEX IF EXISTS public.idx_activity_log_team_created;
DROP INDEX IF EXISTS public.screen_groups_team_id_idx;
DROP INDEX IF EXISTS public.idx_playlist_items_asset_id;
DROP INDEX IF EXISTS public.idx_playlists_team_id;
