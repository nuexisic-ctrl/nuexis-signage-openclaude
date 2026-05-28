-- Fix device orientation update bypass in check_anon_heartbeat_update trigger function.
CREATE OR REPLACE FUNCTION public.check_anon_heartbeat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  if coalesce(auth.role(), 'anon') = 'anon' then
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

CREATE OR REPLACE FUNCTION public.update_player_device_orientation(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text,
  p_orientation integer
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF p_orientation NOT IN (0, 90, 180, 270) THEN
    RAISE EXCEPTION 'Invalid orientation value';
  END IF;

  -- Set local session variable to bypass the orientation check in the trigger
  PERFORM set_config('player.bypass_orientation_check', 'true', true);

  UPDATE public.devices
  SET orientation = p_orientation
  WHERE id = p_device_id
    AND hardware_id = p_hardware_id
    AND secret = extensions.crypt(p_secret, secret);

  -- Reset the variable
  PERFORM set_config('player.bypass_orientation_check', 'false', true);
END;
$$;
