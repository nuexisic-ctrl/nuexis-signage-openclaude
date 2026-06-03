-- Migration: Add folder support to assets table
ALTER TABLE public.assets ADD COLUMN folder_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD COLUMN color VARCHAR(7) DEFAULT '#78716c';
