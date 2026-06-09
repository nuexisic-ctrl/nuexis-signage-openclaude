-- Create index on assets(folder_id) to optimize folder content queries
CREATE INDEX IF NOT EXISTS idx_assets_folder_id ON public.assets(folder_id);

-- Create index on devices(team_id) to optimize screen lists and RLS policies
CREATE INDEX IF NOT EXISTS idx_devices_team_id ON public.devices(team_id);

-- Create index on profiles(team_id) to optimize profile checks and RLS policies
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
