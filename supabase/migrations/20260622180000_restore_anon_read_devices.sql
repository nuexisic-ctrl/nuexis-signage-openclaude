-- Migration: Restore secure anonymous read policy on devices table
-- 
-- Allows the 'anon' role (used by player devices) to select rows from the public.devices table,
-- but only if they are paired (team_id is not null). This is required for Supabase Realtime
-- postgres_changes subscriptions to function on the player, while protecting unpaired device
-- pairing codes from world-read exposure (fixing S-1 without breaking realtime sync).

CREATE POLICY "allow_anon_read_devices" ON public.devices
  FOR SELECT TO anon
  USING (team_id IS NOT NULL);
