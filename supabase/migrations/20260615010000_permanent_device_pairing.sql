-- Migration: Make device pairing codes permanent
-- 
-- Redefine unpair_player_device to set expires_at to 100 years in the future instead of now().
-- This ensures the pairing code remains active and never expires after unpairing.

DROP FUNCTION IF EXISTS public.unpair_player_device(uuid, text, text);

CREATE OR REPLACE FUNCTION public.unpair_player_device(
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

  UPDATE public.device_sessions SET revoked_at = now() WHERE device_id = p_device_id AND revoked_at IS NULL;
  
  UPDATE public.devices
     SET team_id = null,
         name = null,
         content_type = null,
         asset_id = null,
         playlist_id = null,
         status = 'pairing',
         expires_at = now() + interval '100 years'
   WHERE id = p_device_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unpair_player_device(uuid, text, text) TO anon, authenticated;

-- Update existing unpaired devices to have permanent pairing codes
UPDATE public.devices
SET expires_at = now() + interval '100 years'
WHERE team_id IS NULL;
