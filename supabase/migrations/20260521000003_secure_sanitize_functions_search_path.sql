-- Phase 3: Set search_path = public and make security definer for sanitize functions to prevent search path hijacking (M-01)

CREATE OR REPLACE FUNCTION public.sanitize_name(input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML tags, trim whitespace, limit length to 255 chars
  RETURN left(
    trim(
      regexp_replace(input, '<[^>]*>', '', 'g')
    ),
    255
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_asset_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF new.file_name IS NOT NULL THEN
    new.file_name := public.sanitize_name(new.file_name);
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_device_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF new.name IS NOT NULL THEN
    new.name := public.sanitize_name(new.name);
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_playlist_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF new.name IS NOT NULL THEN
    new.name := public.sanitize_name(new.name);
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_team_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF new.name IS NOT NULL THEN
    new.name := public.sanitize_name(new.name);
  END IF;
  RETURN new;
END;
$$;
