-- Ported from BarrelConnect migration 003_horses_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Horses table (add horse / edit horse screen)
-- Fixes: "Could not find the 'age' column of 'horses' in the schema cache"
--
-- How to apply:
-- 1. Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run
-- 2. (Optional) Settings -> API -> Reload schema cache
--
-- If you already have a horses table with fewer columns, the ALTER statements add missing columns.

-- Create horses table if it doesn't exist (full schema for new projects)
CREATE TABLE IF NOT EXISTS public.horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  age INTEGER,
  color TEXT,
  gender TEXT,
  registration_number TEXT,
  breed_registry TEXT,
  date_of_birth TEXT,
  color_markings TEXT,
  sire_name TEXT,
  dam_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  primary_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns if the table already existed with an older schema
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS breed TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS breed_registry TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS color_markings TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS sire_name TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS dam_name TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS primary_photo TEXT;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_horses_owner_id ON public.horses(owner_id);
CREATE INDEX IF NOT EXISTS idx_horses_created_at ON public.horses(created_at DESC);

-- RLS
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own horses" ON public.horses;
CREATE POLICY "Users can view own horses"
  ON public.horses FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own horses" ON public.horses;
CREATE POLICY "Users can insert own horses"
  ON public.horses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own horses" ON public.horses;
CREATE POLICY "Users can update own horses"
  ON public.horses FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own horses" ON public.horses;
CREATE POLICY "Users can delete own horses"
  ON public.horses FOR DELETE
  USING (auth.uid() = owner_id);

-- Optional: horse_performance view for My Horses screen stats (requires runs table with horse_id)
-- Uncomment below if you have a runs table with time_seconds and want aggregate stats per horse.
/*
CREATE OR REPLACE VIEW public.horse_performance AS
SELECT
  horse_id,
  COUNT(*)::integer AS total_runs,
  MIN(time_seconds)::double precision AS best_time,
  AVG(time_seconds)::double precision AS average_time
FROM public.runs
WHERE horse_id IS NOT NULL AND status = 'complete'
GROUP BY horse_id;
*/
