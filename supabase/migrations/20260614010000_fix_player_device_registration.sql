-- Migration: Fix player device registration and RLS policies for Realtime
-- 
-- Fixes:
-- 1. Redefine register_player_device to allow overwriting unpaired devices' code/secret (e.g. on reinstall)
--    and keeping the existing pairing code string so it never changes for a given device.
-- 2. Update devices_select_consolidated RLS policy to allow public select, restoring Realtime updates for anon clients

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Redefine register_player_device RPC
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.register_player_device(
  p_hardware_id text,
  p_pairing_code text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_secret text := gen_random_uuid()::text;
  v_id uuid;
  v_exp timestamptz;
  v_code text;
BEGIN
  -- Set local session variable to bypass configuration update checks in enforce_anon_heartbeat trigger
  PERFORM set_config('player.bypass_configuration_check', 'true', true);

  SELECT * INTO v_device FROM public.devices WHERE hardware_id = p_hardware_id LIMIT 1;
  
  IF v_device.id IS NOT NULL THEN
    -- Keep the existing pairing code if it exists, otherwise use the new one
    v_code := coalesce(v_device.pairing_code, upper(p_pairing_code));
    
    -- Reset team_id and update code/secret/expiry
    UPDATE public.devices
    SET pairing_code = v_code,
        status = 'pairing',
        expires_at = p_expires_at,
        team_id = NULL, -- Unpair the device to allow clean re-pairing
        secret = extensions.crypt(v_secret, extensions.gen_salt('bf'))
    WHERE id = v_device.id
    RETURNING id, expires_at INTO v_id, v_exp;
    
    RETURN jsonb_build_object(
      'id', v_id,
      'expires_at', v_exp,
      'secret', v_secret,
      'pairing_code', v_code
    );
  END IF;

  INSERT INTO public.devices (hardware_id, pairing_code, status, expires_at, secret)
  VALUES (p_hardware_id, upper(p_pairing_code), 'pairing', p_expires_at, extensions.crypt(v_secret, extensions.gen_salt('bf')))
  RETURNING id, expires_at INTO v_id, v_exp;

  RETURN jsonb_build_object(
    'id', v_id,
    'expires_at', v_exp,
    'secret', v_secret,
    'pairing_code', upper(p_pairing_code)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Update devices SELECT policy to allow public read
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS devices_select_consolidated ON public.devices;
CREATE POLICY devices_select_consolidated ON public.devices
  FOR SELECT
  TO public
  USING (true);
