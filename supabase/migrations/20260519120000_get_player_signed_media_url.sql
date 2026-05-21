-- Player-authenticated signed URL for private workspace-media assets (Android / native clients).
create or replace function public.get_player_signed_media_url(
  p_hardware_id text,
  p_secret text,
  p_file_path text,
  p_expires_in integer default 3600
)
returns text
language plpgsql
security definer
set search_path to 'public', 'storage'
as $$
declare
  v_device public.devices;
  v_bucket text := 'workspace-media';
  v_signed record;
begin
  if p_file_path is null or length(trim(p_file_path)) = 0 then
    raise exception 'file path required';
  end if;

  if p_file_path like 'http://%' or p_file_path like 'https://%' then
    return p_file_path;
  end if;

  select *
    into v_device
    from public.devices
    where hardware_id = p_hardware_id
    order by created_at desc
    limit 1;

  if v_device.id is null
     or v_device.team_id is null
     or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;

  if not p_file_path like v_device.team_id::text || '/%' then
    raise exception 'Unauthorized file path';
  end if;

  select * into v_signed
    from storage.create_signed_url(v_bucket, p_file_path, p_expires_in);

  if v_signed.signed_url is null then
    raise exception 'Failed to generate signed URL';
  end if;

  return v_signed.signed_url;
end;
$$;

grant execute on function public.get_player_signed_media_url(text, text, text, integer)
  to anon, authenticated;
