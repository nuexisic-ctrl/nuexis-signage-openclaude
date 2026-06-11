-- Fix check_anon_heartbeat_update and register_player_device to allow bypassing configuration check on pairing/registration reset.

CREATE OR REPLACE FUNCTION public.check_anon_heartbeat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  if coalesce(auth.role(), 'anon') = 'anon' then
    -- Allow complete bypass for secure, defined RPCs like register_player_device
    if current_setting('player.bypass_configuration_check', true) = 'true' then
      return new;
    end if;

    if current_setting('player.bypass_orientation_check', true) = 'true' then
      -- Bypass orientation check, but still restrict other fields
      if new.id is distinct from old.id
         or new.team_id is distinct from old.team_id
         or new.name is distinct from old.name
         or new.content_type is distinct from old.content_type
         or new.asset_id is distinct from old.asset_id
      then
        raise exception 'Devices cannot modify their own configurations.';
      end if;
    else
      -- Standard restrictions apply
      if new.id is distinct from old.id
         or new.team_id is distinct from old.team_id
         or new.name is distinct from old.name
         or new.content_type is distinct from old.content_type
         or new.asset_id is distinct from old.asset_id
         or new.orientation is distinct from old.orientation
      then
        raise exception 'Devices cannot modify their own configurations.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

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
    -- If device exists, update it to pairing mode: reset team_id, generate a new secret and pairing code.
    -- This allows recovery if the client lost its secret (e.g. cleared storage or reinstalled app).
    UPDATE public.devices
    SET pairing_code = upper(p_pairing_code),
        status = 'pairing',
        expires_at = p_expires_at,
        team_id = null,
        secret = extensions.crypt(v_secret, extensions.gen_salt('bf'))
    WHERE id = v_device.id
    RETURNING id, expires_at INTO v_id, v_exp;
    
    -- Reset the bypass config variable
    PERFORM set_config('player.bypass_configuration_check', 'false', true);
    
    RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
  END IF;

  INSERT INTO public.devices (hardware_id, pairing_code, status, expires_at, secret)
  VALUES (p_hardware_id, upper(p_pairing_code), 'pairing', p_expires_at, extensions.crypt(v_secret, extensions.gen_salt('bf')))
  RETURNING id, expires_at INTO v_id, v_exp;

  -- Reset the bypass config variable
  PERFORM set_config('player.bypass_configuration_check', 'false', true);

  RETURN jsonb_build_object('id', v_id, 'expires_at', v_exp, 'secret', v_secret);
END;
$$;
