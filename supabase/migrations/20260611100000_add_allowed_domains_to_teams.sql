ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS allowed_domains text[] DEFAULT '{}'::text[];
