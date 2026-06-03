alter table public.devices
  add column if not exists content text;

comment on column public.devices.content is
  'Resolved content URL or descriptor for the current screen assignment. Asset pushes store the selected asset URL here while asset_id remains the playable source of truth.';
