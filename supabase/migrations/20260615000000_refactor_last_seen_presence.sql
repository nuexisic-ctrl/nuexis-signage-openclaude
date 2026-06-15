-- Migration: Refactor Last Seen Presence Tracking
--
-- 1. Add updated_at column to devices table
-- 2. Create trigger to set updated_at on relevant updates
-- 3. Create ping_device RPCs (overloaded for session-based and secret-based authentication)
-- 4. Modify screen group and member triggers to touch updated_at instead of last_seen_at
-- 5. Update update_device_statuses threshold to 3 minutes

-- 1. Add updated_at column to devices
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create trigger function to set updated_at (ignoring heartbeat/last_seen updates)
CREATE OR REPLACE FUNCTION public.trigger_set_device_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS set_device_updated_at ON public.devices;
CREATE TRIGGER set_device_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_device_updated_at();

-- 3. Create ping_device RPCs
-- Overload A: for session-authenticated clients (Android Player)
CREATE OR REPLACE FUNCTION public.ping_device(
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
BEGIN
  -- Validate session token
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized device session';
  END IF;

  -- Update device last_seen_at and status in the DB (throttled to at most once per 60 seconds)
  UPDATE public.devices
  SET status = 'online',
      last_seen_at = now()
  WHERE id = p_device_id
    AND (
      status IS DISTINCT FROM 'online'
      OR last_seen_at IS NULL
      OR last_seen_at < now() - interval '60 seconds'
    );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Overload B: for secret-authenticated clients (Web Player)
CREATE OR REPLACE FUNCTION public.ping_device(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
BEGIN
  SELECT * INTO v_device FROM public.devices WHERE id = p_device_id AND hardware_id = p_hardware_id;
  IF v_device.id IS NULL OR NOT public.device_secret_matches(v_device, p_secret) THEN
    RAISE EXCEPTION 'Unauthorized device';
  END IF;

  -- Update device last_seen_at and status in the DB (throttled to at most once per 60 seconds)
  UPDATE public.devices
  SET status = 'online',
      last_seen_at = now()
  WHERE id = p_device_id
    AND (
      status IS DISTINCT FROM 'online'
      OR last_seen_at IS NULL
      OR last_seen_at < now() - interval '60 seconds'
    );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Modify screen group triggers to touch updated_at instead of last_seen_at
CREATE OR REPLACE FUNCTION public.on_screen_group_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only cascade if content-related columns actually changed
  IF OLD.content_type    IS DISTINCT FROM NEW.content_type
  OR OLD.asset_id        IS DISTINCT FROM NEW.asset_id
  OR OLD.playlist_id     IS DISTINCT FROM NEW.playlist_id
  OR OLD.orientation     IS DISTINCT FROM NEW.orientation
  THEN
    -- Touch member devices that have NO explicit content of their own.
    UPDATE public.devices
       SET updated_at = now()
     WHERE id IN (
       SELECT sgm.device_id
         FROM public.screen_group_members sgm
        WHERE sgm.group_id = NEW.id
     )
     AND (
       content_type IS NULL
       OR (content_type = 'Asset' AND asset_id IS NULL)
       OR (content_type = 'Playlist' AND playlist_id IS NULL)
     );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_screen_group_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Device removed from group: touch updated_at to trigger player re-fetch
    UPDATE public.devices
       SET updated_at = now()
     WHERE id = OLD.device_id;
    RETURN OLD;
  ELSE
    -- Device added to group: touch updated_at to trigger player re-fetch
    UPDATE public.devices
       SET updated_at = now()
     WHERE id = NEW.device_id;
    RETURN NEW;
  END IF;
END;
$$;

-- 5. Update update_device_statuses threshold to 3 minutes
CREATE OR REPLACE FUNCTION public.update_device_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.devices
  SET status = CASE
    WHEN last_seen_at >= now() - interval '3 minutes' THEN 'online'
    ELSE 'offline'
  END
  WHERE team_id IS NOT NULL
    AND status <> CASE
      WHEN last_seen_at >= now() - interval '3 minutes' THEN 'online'
      ELSE 'offline'
    END;
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.ping_device(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ping_device(uuid, text, text) TO anon, authenticated;
