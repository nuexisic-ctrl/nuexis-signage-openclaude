-- Create screen_groups table
create table if not exists public.screen_groups (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  color         text default '#3b82f6',
  content_type  text check (content_type in ('Asset','Playlist','Schedule')),
  asset_id      uuid references public.assets(id) on delete set null,
  playlist_id   uuid references public.playlists(id) on delete set null,
  orientation   smallint default 0 check (orientation in (0,90,180,270)),
  created_at    timestamptz default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists screen_groups_team_id_idx on public.screen_groups (team_id);
create unique index if not exists screen_groups_team_name_uniq_idx on public.screen_groups (team_id, lower(name));

-- Create screen_group_members junction table
create table if not exists public.screen_group_members (
  group_id   uuid not null references public.screen_groups(id) on delete cascade,
  device_id  uuid not null references public.devices(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  is_primary boolean default false,
  added_at   timestamptz default now(),
  primary key (group_id, device_id)
);

create index if not exists screen_group_members_device_idx on public.screen_group_members (device_id);
create index if not exists screen_group_members_team_idx on public.screen_group_members (team_id);

-- Enable RLS
alter table public.screen_groups enable row level security;
alter table public.screen_group_members enable row level security;

-- Setup RLS Policies on screen_groups
drop policy if exists "team can read groups" on public.screen_groups;
create policy "team can read groups" on public.screen_groups
  for select to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

drop policy if exists "owners can write groups" on public.screen_groups;
create policy "owners can write groups" on public.screen_groups
  for all to authenticated
  using (
    team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'owner')
  );

-- Setup RLS Policies on screen_group_members
drop policy if exists "team can read members" on public.screen_group_members;
create policy "team can read members" on public.screen_group_members
  for select to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

drop policy if exists "owners can write members" on public.screen_group_members;
create policy "owners can write members" on public.screen_group_members
  for all to authenticated
  using (
    team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'owner')
  );

-- Touch Trigger Function for screen_group_members
create or replace function public.on_screen_group_member_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if TG_OP = 'DELETE' then
    update public.devices
       set last_seen_at = now()
     where id = OLD.device_id;
    return OLD;
  else
    update public.devices
       set last_seen_at = now()
     where id = NEW.device_id;
    return NEW;
  end if;
end;
$$;

-- Member change trigger
drop trigger if exists trg_screen_group_member_change on public.screen_group_members;
create trigger trg_screen_group_member_change
after insert or update or delete
on public.screen_group_members
for each row
execute function public.on_screen_group_member_change();

-- Touch Trigger Function for screen_groups
create or replace function public.on_screen_group_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.devices
     set last_seen_at = now()
   where id in (
     select device_id 
     from public.screen_group_members 
     where group_id = NEW.id
   );
  return NEW;
end;
$$;

-- Group change trigger
drop trigger if exists trg_screen_group_change on public.screen_groups;
create trigger trg_screen_group_change
after update
on public.screen_groups
for each row
execute function public.on_screen_group_change();

-- Device State Resolution Helper Function
create or replace function public.resolve_device_state(p_device public.devices)
returns public.devices
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_res public.devices := p_device;
  v_grp_content_type text;
  v_grp_asset_id uuid;
  v_grp_playlist_id uuid;
  v_grp_orientation integer;
begin
  -- If device does not have explicit content assigned, resolve from group
  if v_res.content_type is null or 
     (v_res.content_type = 'Asset' and v_res.asset_id is null) or 
     (v_res.content_type = 'Playlist' and v_res.playlist_id is null) then
     
     select sg.content_type, sg.asset_id, sg.playlist_id, sg.orientation
       into v_grp_content_type, v_grp_asset_id, v_grp_playlist_id, v_grp_orientation
       from public.screen_group_members sgm
       join public.screen_groups sg on sg.id = sgm.group_id
      where sgm.device_id = v_res.id
      order by sgm.is_primary desc, sgm.added_at desc
      limit 1;
      
     if found then
       v_res.content_type := v_grp_content_type;
       v_res.asset_id := v_grp_asset_id;
       v_res.playlist_id := v_grp_playlist_id;
       v_res.orientation := coalesce(v_grp_orientation, v_res.orientation);
     end if;
  end if;
  
  return v_res;
end;
$$;

-- Rebuild public.get_player_device_state
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
  v_resolved public.devices;
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

  -- Resolve content
  v_resolved := public.resolve_device_state(v_device);

  return to_jsonb(v_resolved) - 'secret' - 'device_secret_hash';
end;
$$;

-- Rebuild public.validate_device_session
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
  v_resolved public.devices;
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

  -- Resolve content
  v_resolved := public.resolve_device_state(v_device);

  return to_jsonb(v_resolved) - 'secret' - 'device_secret_hash';
end;
$$;

-- Ensure execution privileges are intact
grant execute on function public.get_player_device_state(text, text) to anon, authenticated;
grant execute on function public.validate_device_session(uuid, text) to anon, authenticated;

-- Add screen grouping tables to supabase_realtime publication
alter publication supabase_realtime add table public.screen_groups, public.screen_group_members;
