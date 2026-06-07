-- Widget edit audit log table
-- Records every time a widget asset is modified so we maintain a full history.

create table if not exists public.widget_edit_logs (
  id             uuid        primary key default gen_random_uuid(),
  asset_id       uuid        not null references public.assets(id) on delete cascade,
  team_id        uuid        not null references public.teams(id) on delete cascade,
  edited_by      uuid        not null,
  previous_name  text,
  new_name       text,
  previous_path  text,
  new_path       text,
  created_at     timestamptz not null default now()
);

-- Performance: look up audit trail for a specific widget quickly
create index if not exists widget_edit_logs_asset_created_idx
  on public.widget_edit_logs(asset_id, created_at desc);

-- Performance: look up all edits made by a team
create index if not exists widget_edit_logs_team_created_idx
  on public.widget_edit_logs(team_id, created_at desc);

-- Enable RLS
alter table public.widget_edit_logs enable row level security;

-- Team members can read their own team's audit logs
create policy "team can read widget edit logs"
  on public.widget_edit_logs for select
  to authenticated
  using (team_id = ((auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid));

-- Only server-side (service_role) can insert/update/delete
revoke insert, update, delete on public.widget_edit_logs from anon, authenticated;
