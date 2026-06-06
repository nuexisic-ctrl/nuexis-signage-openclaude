-- Migration: Add historical playtime tracking to teams
alter table public.teams add column if not exists historical_playtime_seconds bigint not null default 0;

create or replace function public.handle_device_playtime_migration()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- If deleted, add playtime to the team's historical playtime
  if tg_op = 'DELETE' then
    if old.team_id is not null and old.total_playtime_seconds > 0 then
      update public.teams
      set historical_playtime_seconds = coalesce(historical_playtime_seconds, 0) + old.total_playtime_seconds
      where id = old.team_id;
    end if;
  -- If team_id is updated to NULL (unpaired) or changed
  elsif tg_op = 'UPDATE' then
    if old.team_id is not null and (new.team_id is null or new.team_id is distinct from old.team_id) then
      if old.total_playtime_seconds > 0 then
        update public.teams
        set historical_playtime_seconds = coalesce(historical_playtime_seconds, 0) + old.total_playtime_seconds
        where id = old.team_id;
      end if;
      -- Reset the playtime on the device since it's no longer with the old team
      new.total_playtime_seconds := 0;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_device_playtime_migration on public.devices;
create trigger trg_device_playtime_migration
before delete or update of team_id on public.devices
for each row
execute function public.handle_device_playtime_migration();
