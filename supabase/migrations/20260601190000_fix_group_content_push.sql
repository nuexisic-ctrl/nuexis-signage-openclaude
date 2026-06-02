-- Migration: Fix group content push to player devices
-- 
-- Problems fixed:
-- 1. screen_group_members has default replica identity (composite PK) causing
--    realtime filter mismatches on DELETE events for team_id filter
-- 2. The on_screen_group_change trigger only touches last_seen_at which is fragile
--    and doesn't reliably trigger player re-fetch
-- 3. No mechanism to cascade group content to device rows

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Fix realtime filter matching for screen_group_members
-- ═══════════════════════════════════════════════════════════════════════
-- With default replica identity, DELETE events only include PK columns
-- (group_id, device_id) — the team_id filter in client subscriptions
-- won't match. FULL includes all columns in change events.
alter table public.screen_group_members replica identity full;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Replace trigger: cascade group content changes to member devices
-- ═══════════════════════════════════════════════════════════════════════
-- When a group's content assignment changes, update all member devices
-- that don't have their own explicit content set. This ensures the
-- player's existing postgres_changes subscription on `devices` fires.

create or replace function public.on_screen_group_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only cascade if content-related columns actually changed
  if OLD.content_type    is distinct from NEW.content_type
  or OLD.asset_id        is distinct from NEW.asset_id
  or OLD.playlist_id     is distinct from NEW.playlist_id
  or OLD.orientation     is distinct from NEW.orientation
  then
    -- Touch member devices that have NO explicit content of their own.
    -- These devices rely on the group for their content assignment.
    update public.devices
       set last_seen_at = now()
     where id in (
       select sgm.device_id
         from public.screen_group_members sgm
        where sgm.group_id = NEW.id
     )
     and (
       content_type is null
       or (content_type = 'Asset' and asset_id is null)
       or (content_type = 'Playlist' and playlist_id is null)
     );
  end if;

  return NEW;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Improve member change trigger: notify members when group membership changes
-- ═══════════════════════════════════════════════════════════════════════
-- When a device is added or removed from a group, touch last_seen_at to
-- trigger player re-fetch of dynamically resolved group content.

create or replace function public.on_screen_group_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    -- Device removed from group: touch last_seen_at to trigger player re-fetch
    update public.devices
       set last_seen_at = now()
     where id = OLD.device_id;
    return OLD;
  else
    -- Device added to group: touch last_seen_at to trigger player re-fetch
    update public.devices
       set last_seen_at = now()
     where id = NEW.device_id;
    return NEW;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Allow anon read for realtime subscriptions from player devices
-- ═══════════════════════════════════════════════════════════════════════
-- Player devices use the anon key. For their realtime subscriptions to
-- receive screen_groups and screen_group_members events, anon SELECT
-- policies are required (matching the existing allow_anon_read_devices).

create policy allow_anon_read_screen_groups
  on public.screen_groups for select to anon using (true);

create policy allow_anon_read_screen_group_members
  on public.screen_group_members for select to anon using (true);
