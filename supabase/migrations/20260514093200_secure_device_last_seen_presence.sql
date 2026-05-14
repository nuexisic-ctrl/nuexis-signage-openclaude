create index if not exists devices_team_last_seen_idx
  on public.devices (team_id, last_seen_at desc)
  where team_id is not null;

drop policy if exists "claim_or_update_device" on public.devices;
drop policy if exists "public_update_unpaired_device" on public.devices;
drop policy if exists "device_update_self" on public.devices;
drop policy if exists "public_insert_device" on public.devices;
drop policy if exists "device_delete_self" on public.devices;

create or replace function public.check_anon_heartbeat_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), 'anon') <> 'service_role' then
    if new.id is distinct from old.id
       or new.team_id is distinct from old.team_id
       or new.name is distinct from old.name
       or new.pairing_code is distinct from old.pairing_code
       or new.status is distinct from old.status
       or new.expires_at is distinct from old.expires_at
       or new.created_at is distinct from old.created_at
       or new.hardware_id is distinct from old.hardware_id
       or new.content_type is distinct from old.content_type
       or new.asset_id is distinct from old.asset_id
       or new.scale_mode is distinct from old.scale_mode
       or new.orientation is distinct from old.orientation
       or new.secret is distinct from old.secret
       or new.last_seen_at is distinct from old.last_seen_at
    then
      raise exception 'Device rows can only be changed through trusted server actions';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.update_device_statuses()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.devices
  set status = case
    when last_seen_at >= now() - interval '120 seconds' then 'online'
    else 'offline'
  end
  where team_id is not null
    and status <> case
      when last_seen_at >= now() - interval '120 seconds' then 'online'
      else 'offline'
    end;
end;
$$;
