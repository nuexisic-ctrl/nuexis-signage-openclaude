-- ============================================================
-- Migration: Harden remaining RLS policies & drop orphaned RPC
-- ============================================================

-- ── 1. Drop orphaned get_player_signed_media_url_by_session ──────────────
-- This function was added in 20260528140000 but references the non-existent
-- validate_device_session() function. The app uses get_player_signed_media_url
-- instead. Dropping to prevent runtime exceptions if it is ever accidentally called.
DROP FUNCTION IF EXISTS public.get_player_signed_media_url_by_session(uuid, text, text, integer);

-- ── 2. Restrict devices_select_consolidated from public to authenticated ──
-- The player never does a direct .from('devices').select() — all player
-- operations use SECURITY DEFINER RPCs which bypass RLS. The x-device-secret
-- header path in the SELECT policy is unnecessary and exposes a wider attack
-- surface. Restricting to authenticated removes anon direct table access.
DROP POLICY IF EXISTS devices_select_consolidated ON public.devices;
CREATE POLICY devices_select_consolidated ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
    OR team_id IS NULL
  );

-- ── 3. Restrict profiles policies from public to authenticated ────────────
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ── 4. Restrict teams policies from public to authenticated ───────────────
DROP POLICY IF EXISTS "Team members can read their team" ON public.teams;
CREATE POLICY "Team members can read their team" ON public.teams
  FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Team owner can update their team" ON public.teams;
CREATE POLICY "Team owner can update their team" ON public.teams
  FOR UPDATE
  TO authenticated
  USING (id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'owner'
  ))
  WITH CHECK (id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'owner'
  ));
