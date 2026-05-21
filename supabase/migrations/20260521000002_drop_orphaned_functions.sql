-- Drop the orphaned and non-functional get_signed_media_url function
DROP FUNCTION IF EXISTS public.get_signed_media_url(p_file_path text, p_expires_in integer);
