-- Update register_player_device to support persistent pairing across uninstalls.
-- If a device with the same hardware_id is already paired, we return its existing state
-- but generate a new secret so the fresh install can securely resume.

CREATE OR REPLACE FUNCTION public.register_player_device(
  p_hardware_id text,
  p_pairing_code text,
  p_expires_at timestamptz
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_device public.devices;
  v_secret text := gen_random_uuid()::text;
  v_id uuid;
  v_exp timestamptz;
BEGIN
  -- Set local session variable to bypass configuration checks in trigger
  PERFORM set_config('player.bypass_configuration_check', 'true', true);

  SELECT * INTO v_device FROM public.devices WHERE hardware_id = p_hardware_id LIMIT 1;
  
  IF v_device.id IS NOT NULL THEN
    -- If device exists and IS already paired (team_id is not null)
    IF v_device.team_id IS NOT NULL THEN
      UPDATE public.devices
      SET secret = extensions.crypt(v_secret, extensions.gen_salt('bf')),
          last_seen_at = now(),
          status = 'online'
      WHERE id = v_device.id
      RETURNING id, expires_at INTO v_id, v_exp;
      
      -- Reset the bypass config variable
      PERFORM set_config('player.bypass_configuration_check', 'false', true);
      
      RETURN jsonb_build_object(
        'id', v_id, 
        'expires_at', v_exp, 
        'secret', v_secret, 
        'team_id', v_device.team_id,
        'status', 'online',
        'name', v_device.name
      );
    END IF;

    -- If device exists but NOT paired, update it for a new pairing attempt
    UPDATE public.devices
    SET pairing_code = upper(p_pairing_code),
        status = 'pairing',
        expires_at = p_expires_at,
        team_id = null,
        secret = extensions.crypt(v_secret, extensions.gen_salt('bf')),
        last_seen_at = now()
    WHERE id = v_device.id
    RETURNING id, expires_at INTO v_id, v_exp;
    
    -- Reset the bypass config variable
    PERFORM set_config('player.bypass_configuration_check', 'false', true);
    
    RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
  END IF;

  -- New device registration
  INSERT INTO public.devices (hardware_id, pairing_code, status, expires_at, secret, last_seen_at)
  VALUES (p_hardware_id, upper(p_pairing_code), 'pairing', p_expires_at, extensions.crypt(v_secret, extensions.gen_salt('bf')), now())
  RETURNING id, expires_at INTO v_id, v_exp;

  -- Reset the bypass config variable
  PERFORM set_config('player.bypass_configuration_check', 'false', true);

  RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
END;
$$;
