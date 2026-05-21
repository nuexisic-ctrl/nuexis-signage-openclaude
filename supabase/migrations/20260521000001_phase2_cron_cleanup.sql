-- Schedule update_device_statuses() to run every 2 minutes using pg_cron
-- This marks devices offline after 120 seconds of inactivity.

-- 1. Unschedule if already exists to make migration idempotent
SELECT cron.unschedule('mark-offline-devices')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mark-offline-devices'
);

-- 2. Schedule the cron job
SELECT cron.schedule('mark-offline-devices', '*/2 * * * *', $$SELECT public.update_device_statuses()$$);
