create extension if not exists pgcrypto;

alter table public.devices
  add column if not exists device_secret_hash text,
  add column if not exists current_manifest_version text,
  add column if not exists app_version text,
  add column if not exists os_version text,
  add column if not exists free_disk_bytes bigint,
  add column if not exists memory_class_mb integer,
  add column if not exists network_type text,
  add column if not exists last_error text;

create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  token_hash text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz
);

create table if not exists public.device_playback_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  item_id uuid,
  asset_id uuid references public.assets(id) on delete set null,
  event_type text not null,
  position_ms bigint not null default 0,
  duration_ms bigint not null default 0,
  cache_status text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.device_health_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  app_version text,
  os_version text,
  free_disk_bytes bigint,
  memory_class_mb integer,
  network_type text,
  manifest_version text,
  current_item_id uuid,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists devices_hardware_id_idx on public.devices(hardware_id);
create unique index if not exists devices_pairing_code_unpaired_idx
  on public.devices(pairing_code)
  where team_id is null;
create index if not exists device_sessions_device_idx
  on public.device_sessions(device_id, expires_at desc)
  where revoked_at is null;
create index if not exists device_playback_events_device_created_idx
  on public.device_playback_events(device_id, created_at desc);
create index if not exists device_health_events_device_created_idx
  on public.device_health_events(device_id, created_at desc);

alter table public.devices enable row level security;
alter table public.device_sessions enable row level security;
alter table public.device_playback_events enable row level security;
alter table public.device_health_events enable row level security;

drop policy if exists "team can read devices" on public.devices;
drop policy if exists "team can update devices" on public.devices;
drop policy if exists "team can delete devices" on public.devices;
create policy "team can read devices"
  on public.devices for select
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));
create policy "team can update devices"
  on public.devices for update
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid))
  with check (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));
create policy "team can delete devices"
  on public.devices for delete
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

drop policy if exists "team can read playback events" on public.device_playback_events;
create policy "team can read playback events"
  on public.device_playback_events for select
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

drop policy if exists "team can read health events" on public.device_health_events;
create policy "team can read health events"
  on public.device_health_events for select
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

revoke all on public.device_sessions from anon, authenticated;
revoke insert, update, delete on public.device_playback_events from anon, authenticated;
revoke insert, update, delete on public.device_health_events from anon, authenticated;

create or replace function public.device_secret_matches(
  p_device public.devices,
  p_secret text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_secret is not null
    and (
      (p_device.device_secret_hash is not null and p_device.device_secret_hash = crypt(p_secret, p_device.device_secret_hash))
      or (p_device.device_secret_hash is null and p_device.secret is not null and p_device.secret = p_secret)
    );
$$;

create or replace function public.register_player_device(
  p_hardware_id text,
  p_pairing_code text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
  v_secret text := encode(gen_random_bytes(32), 'hex');
begin
  select *
    into v_device
    from public.devices
    where hardware_id = p_hardware_id
      and team_id is null
    order by created_at desc
    limit 1;

  if v_device.id is null then
    insert into public.devices (
      hardware_id,
      pairing_code,
      expires_at,
      status,
      secret,
      device_secret_hash
    )
    values (
      p_hardware_id,
      upper(p_pairing_code),
      p_expires_at,
      'pairing',
      null,
      crypt(v_secret, gen_salt('bf'))
    )
    returning * into v_device;
  else
    update public.devices
       set pairing_code = upper(p_pairing_code),
           expires_at = p_expires_at,
           status = 'pairing',
           secret = null,
           device_secret_hash = crypt(v_secret, gen_salt('bf'))
     where id = v_device.id
     returning * into v_device;
  end if;

  return jsonb_build_object('id', v_device.id, 'expires_at', v_device.expires_at, 'secret', v_secret);
end;
$$;

create or replace function public.refresh_player_device_code(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text,
  p_pairing_code text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and hardware_id = p_hardware_id;
  if v_device.id is null or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;

  update public.devices
     set pairing_code = upper(p_pairing_code),
         expires_at = p_expires_at,
         status = 'pairing'
   where id = p_device_id
   returning * into v_device;

  return jsonb_build_object('id', v_device.id, 'expires_at', v_device.expires_at, 'secret', p_secret);
end;
$$;

create or replace function public.get_player_device_state(
  p_hardware_id text,
  p_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select *
    into v_device
    from public.devices
    where hardware_id = p_hardware_id
    order by created_at desc
    limit 1;

  if v_device.id is null then
    return null;
  end if;

  if v_device.team_id is not null and not public.device_secret_matches(v_device, p_secret) then
    return null;
  end if;

  return to_jsonb(v_device) - 'secret' - 'device_secret_hash';
end;
$$;

create or replace function public.claim_device(
  p_pairing_code text,
  p_team_id uuid,
  p_name text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  insert into public.claim_attempts(pairing_code, user_id)
  values (upper(p_pairing_code), p_user_id);

  if auth.uid() is distinct from p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized user');
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
      and team_id = p_team_id
  ) then
    return jsonb_build_object('success', false, 'error', 'User is not a member of this team');
  end if;

  select *
    into v_device
    from public.devices
    where pairing_code = upper(p_pairing_code)
      and team_id is null
      and expires_at > now()
    order by created_at asc
    limit 1
    for update skip locked;

  if v_device.id is null then
    return jsonb_build_object('success', false, 'error', 'Pairing code is invalid or expired');
  end if;

  update public.devices
     set team_id = p_team_id,
         name = nullif(trim(p_name), ''),
         status = 'offline',
         last_seen_at = now()
   where id = v_device.id
   returning * into v_device;

  return jsonb_build_object('success', true, 'device_id', v_device.id);
end;
$$;

create or replace function public.exchange_device_secret_for_session(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '7 days';
  v_manifest jsonb;
begin
  select * into v_device from public.devices where id = p_device_id and hardware_id = p_hardware_id;
  if v_device.id is null or v_device.team_id is null or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;

  insert into public.device_sessions(device_id, token_hash, expires_at, last_seen_at)
  values (v_device.id, crypt(v_token, gen_salt('bf')), v_expires_at, now());

  update public.devices
     set status = 'online',
         last_seen_at = now()
   where id = v_device.id;

  v_manifest := public.get_player_manifest(v_device.id, v_token);
  return jsonb_build_object(
    'device_id', v_device.id,
    'team_id', v_device.team_id,
    'session_token', v_token,
    'expires_at', v_expires_at,
    'manifest', v_manifest
  );
end;
$$;

create or replace function public.validate_device_session(
  p_device_id uuid,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select d.*
    into v_device
    from public.devices d
    join public.device_sessions s on s.device_id = d.id
    where d.id = p_device_id
      and s.revoked_at is null
      and s.expires_at > now()
      and s.token_hash = crypt(p_session_token, s.token_hash)
    order by s.issued_at desc
    limit 1;

  if v_device.id is null then
    return null;
  end if;

  update public.device_sessions
     set last_seen_at = now()
   where device_id = p_device_id
     and revoked_at is null
     and expires_at > now()
     and token_hash = crypt(p_session_token, token_hash);

  return to_jsonb(v_device) - 'secret' - 'device_secret_hash';
end;
$$;

create or replace function public.get_player_manifest(
  p_device_id uuid,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
  v_items jsonb := '[]'::jsonb;
  v_manifest_version text;
begin
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  if v_device.id is null then
    raise exception 'Unauthorized device session';
  end if;

  if v_device.content_type = 'Asset' and v_device.asset_id is not null then
    select jsonb_build_array(
      jsonb_build_object(
        'id', v_device.asset_id,
        'type', case when a.mime_type like 'video/%' then 'video' when a.mime_type like 'image/%' then 'image' else 'widget' end,
        'asset_id', a.id,
        'duration_seconds', 15,
        'sort_order', 0,
        'asset', jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'file_path', a.file_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes
        )
      )
    )
      into v_items
      from public.assets a
      where a.id = v_device.asset_id
        and a.team_id = v_device.team_id;
  elsif v_device.content_type = 'Playlist' and v_device.playlist_id is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'type', pi.type,
        'asset_id', pi.asset_id,
        'duration_seconds', pi.duration_seconds,
        'sort_order', pi.sort_order,
        'asset', case when a.id is null then null else jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'file_path', a.file_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes
        ) end
      )
      order by pi.sort_order
    ), '[]'::jsonb)
      into v_items
      from public.playlist_items pi
      left join public.assets a on a.id = pi.asset_id and a.team_id = v_device.team_id
      where pi.playlist_id = v_device.playlist_id;
  end if;

  v_manifest_version := encode(
    digest(
      coalesce(v_device.content_type, '') || ':' ||
      coalesce(v_device.asset_id::text, '') || ':' ||
      coalesce(v_device.playlist_id::text, '') || ':' ||
      coalesce(v_device.orientation::text, '0') || ':' ||
      v_items::text,
      'sha256'
    ),
    'hex'
  );

  update public.devices
     set current_manifest_version = v_manifest_version,
         last_seen_at = now(),
         status = 'online'
   where id = v_device.id;

  return jsonb_build_object(
    'manifest_version', v_manifest_version,
    'device_id', v_device.id,
    'team_id', v_device.team_id,
    'content_type', v_device.content_type,
    'orientation', coalesce(v_device.orientation, 0),
    'loop_enabled', true,
    'transition_ms', 350,
    'assignment', jsonb_build_object('asset_id', v_device.asset_id, 'playlist_id', v_device.playlist_id),
    'playlist', v_items
  );
end;
$$;

create or replace function public.report_playback_event(
  p_device_id uuid,
  p_session_token text,
  p_event_type text,
  p_item_id uuid default null,
  p_asset_id uuid default null,
  p_position_ms bigint default 0,
  p_duration_ms bigint default 0,
  p_cache_status text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  if v_device.id is null then raise exception 'Unauthorized device session'; end if;

  insert into public.device_playback_events(
    device_id, team_id, item_id, asset_id, event_type, position_ms, duration_ms, cache_status, error_message
  )
  values (
    v_device.id, v_device.team_id, p_item_id, p_asset_id, lower(p_event_type), p_position_ms, p_duration_ms, p_cache_status, p_error_message
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.report_device_health(
  p_device_id uuid,
  p_session_token text,
  p_app_version text default null,
  p_os_version text default null,
  p_free_disk_bytes bigint default null,
  p_memory_class_mb integer default null,
  p_network_type text default null,
  p_manifest_version text default null,
  p_current_item_id uuid default null,
  p_last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  if v_device.id is null then raise exception 'Unauthorized device session'; end if;

  insert into public.device_health_events(
    device_id, team_id, app_version, os_version, free_disk_bytes, memory_class_mb,
    network_type, manifest_version, current_item_id, last_error
  )
  values (
    v_device.id, v_device.team_id, p_app_version, p_os_version, p_free_disk_bytes, p_memory_class_mb,
    p_network_type, p_manifest_version, p_current_item_id, p_last_error
  );

  update public.devices
     set status = 'online',
         last_seen_at = now(),
         app_version = p_app_version,
         os_version = p_os_version,
         free_disk_bytes = p_free_disk_bytes,
         memory_class_mb = p_memory_class_mb,
         network_type = p_network_type,
         current_manifest_version = coalesce(p_manifest_version, current_manifest_version),
         last_error = p_last_error
   where id = v_device.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.increment_device_playtime(
  p_device_id uuid,
  p_session_token text,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  v_device := jsonb_populate_record(null::public.devices, public.validate_device_session(p_device_id, p_session_token));
  if v_device.id is null then raise exception 'Unauthorized device session'; end if;

  update public.devices
     set total_playtime_seconds = coalesce(total_playtime_seconds, 0) + greatest(p_seconds, 0),
         last_seen_at = now(),
         status = 'online'
   where id = v_device.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.increment_device_playtime(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and hardware_id = p_hardware_id;
  if v_device.id is null or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;

  update public.devices
     set total_playtime_seconds = coalesce(total_playtime_seconds, 0) + greatest(p_seconds, 0),
         last_seen_at = now(),
         status = 'online'
   where id = v_device.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_player_playlist_items(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'playlist_id', pi.playlist_id,
        'type', pi.type,
        'asset_id', pi.asset_id,
        'widget_type', pi.widget_type,
        'widget_config', pi.widget_config,
        'duration_seconds', pi.duration_seconds,
        'sort_order', pi.sort_order,
        'assets', case when a.id is null then null else jsonb_build_object(
          'file_path', a.file_path,
          'mime_type', a.mime_type
        ) end
      )
      order by pi.sort_order
    ), '[]'::jsonb)
    from public.playlist_items pi
    left join public.assets a on a.id = pi.asset_id
    where pi.playlist_id = p_playlist_id
  );
end;
$$;

create or replace function public.unpair_player_device(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and hardware_id = p_hardware_id;
  if v_device.id is null or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;

  update public.device_sessions set revoked_at = now() where device_id = p_device_id and revoked_at is null;
  update public.devices
     set team_id = null,
         name = null,
         content_type = null,
         asset_id = null,
         playlist_id = null,
         status = 'pairing',
         expires_at = now()
   where id = p_device_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.update_player_device_orientation(
  p_device_id uuid,
  p_hardware_id text,
  p_secret text,
  p_orientation integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and hardware_id = p_hardware_id;
  if v_device.id is null or not public.device_secret_matches(v_device, p_secret) then
    raise exception 'Unauthorized device';
  end if;
  update public.devices set orientation = p_orientation where id = p_device_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.register_player_device(text, text, timestamptz) to anon, authenticated;
grant execute on function public.refresh_player_device_code(uuid, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.get_player_device_state(text, text) to anon, authenticated;
grant execute on function public.claim_device(text, uuid, text, uuid) to authenticated;
grant execute on function public.exchange_device_secret_for_session(uuid, text, text) to anon, authenticated;
grant execute on function public.validate_device_session(uuid, text) to anon, authenticated;
grant execute on function public.get_player_manifest(uuid, text) to anon, authenticated;
grant execute on function public.report_playback_event(uuid, text, text, uuid, uuid, bigint, bigint, text, text) to anon, authenticated;
grant execute on function public.report_device_health(uuid, text, text, text, bigint, integer, text, text, uuid, text) to anon, authenticated;
grant execute on function public.increment_device_playtime(uuid, text, integer) to anon, authenticated;
grant execute on function public.increment_device_playtime(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.get_player_playlist_items(uuid) to anon, authenticated;
grant execute on function public.unpair_player_device(uuid, text, text) to anon, authenticated;
grant execute on function public.update_player_device_orientation(uuid, text, text, integer) to anon, authenticated;
