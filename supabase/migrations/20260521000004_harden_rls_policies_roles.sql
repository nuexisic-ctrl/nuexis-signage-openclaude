-- Phase 3: Harden RLS policies by restricting them to the 'authenticated' role instead of 'public'

-- 1. assets table: assets_select_own_team
DROP POLICY IF EXISTS assets_select_own_team ON public.assets;
CREATE POLICY assets_select_own_team ON public.assets
  FOR SELECT
  TO authenticated
  USING (team_id = (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    LIMIT 1
  ));

-- 2. claim_attempts table: Users can delete own attempts
DROP POLICY IF EXISTS "Users can delete own attempts" ON public.claim_attempts;
CREATE POLICY "Users can delete own attempts" ON public.claim_attempts
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3. playlists table: restrict to authenticated
DROP POLICY IF EXISTS "Users can delete team playlists" ON public.playlists;
CREATE POLICY "Users can delete team playlists" ON public.playlists
  FOR DELETE
  TO authenticated
  USING (team_id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert team playlists" ON public.playlists;
CREATE POLICY "Users can insert team playlists" ON public.playlists
  FOR INSERT
  TO authenticated
  WITH CHECK (team_id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update team playlists" ON public.playlists;
CREATE POLICY "Users can update team playlists" ON public.playlists
  FOR UPDATE
  TO authenticated
  USING (team_id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ))
  WITH CHECK (team_id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view team playlists" ON public.playlists;
CREATE POLICY "Users can view team playlists" ON public.playlists
  FOR SELECT
  TO authenticated
  USING (team_id IN (
    SELECT profiles.team_id
    FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

-- 4. playlist_items table: restrict to authenticated
DROP POLICY IF EXISTS "Users can delete team playlist items" ON public.playlist_items;
CREATE POLICY "Users can delete team playlist items" ON public.playlist_items
  FOR DELETE
  TO authenticated
  USING (playlist_id IN (
    SELECT playlists.id
    FROM playlists
    WHERE playlists.team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "Users can insert team playlist items" ON public.playlist_items;
CREATE POLICY "Users can insert team playlist items" ON public.playlist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (playlist_id IN (
    SELECT playlists.id
    FROM playlists
    WHERE playlists.team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "Users can update team playlist items" ON public.playlist_items;
CREATE POLICY "Users can update team playlist items" ON public.playlist_items
  FOR UPDATE
  TO authenticated
  USING (playlist_id IN (
    SELECT playlists.id
    FROM playlists
    WHERE playlists.team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  ))
  WITH CHECK (playlist_id IN (
    SELECT playlists.id
    FROM playlists
    WHERE playlists.team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "Users can view team playlist items" ON public.playlist_items;
CREATE POLICY "Users can view team playlist items" ON public.playlist_items
  FOR SELECT
  TO authenticated
  USING (playlist_id IN (
    SELECT playlists.id
    FROM playlists
    WHERE playlists.team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
  ));

-- 5. devices table RLS optimization for devices_select_consolidated (M-29)
DROP POLICY IF EXISTS devices_select_consolidated ON public.devices;
CREATE POLICY devices_select_consolidated ON public.devices
  FOR SELECT
  TO public
  USING (
    team_id IN (
      SELECT profiles.team_id
      FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
    OR team_id IS NULL
    OR (
      (SELECT current_setting('request.headers', true))::json ->> 'x-device-secret' IS NOT NULL
      AND secret = extensions.crypt((SELECT current_setting('request.headers', true))::json ->> 'x-device-secret', secret)
    )
  );
