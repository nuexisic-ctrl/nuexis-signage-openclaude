-- ============================================================
-- MIGRATION: Revert Event Tables Partitioning
-- Date: 2026-06-20
-- ============================================================

-- 1. Unschedule cron job
SELECT cron.unschedule('manage-partitions-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manage-partitions-job');

-- 2. Drop partition management function
DROP FUNCTION IF EXISTS public.manage_partitions();

-- 3. Create temp table for health events to keep existing data
CREATE TEMP TABLE temp_health_events AS SELECT * FROM public.device_health_events;

-- 4. Drop the partitioned tables (which cascades to all daily partitions)
DROP TABLE public.device_health_events CASCADE;
DROP TABLE public.device_playback_events CASCADE;

-- 5. Create new standard tables
CREATE TABLE public.device_health_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_playback_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  item_id uuid,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  position_ms bigint NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  cache_status text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Re-create indexes
CREATE INDEX IF NOT EXISTS idx_device_health_events_device_created ON public.device_health_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_health_events_team_id ON public.device_health_events(team_id);

CREATE INDEX IF NOT EXISTS idx_device_playback_events_device_created ON public.device_playback_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_team_id ON public.device_playback_events(team_id);
CREATE INDEX IF NOT EXISTS idx_device_playback_events_asset_id ON public.device_playback_events(asset_id);

-- 7. Restore data
INSERT INTO public.device_health_events (id, device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb, network_type, manifest_version, current_item_id, last_error, created_at)
SELECT id, device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb, network_type, manifest_version, current_item_id, last_error, created_at
FROM temp_health_events;

-- 8. Enable RLS and setup policies
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
