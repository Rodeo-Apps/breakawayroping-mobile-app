-- Ported from BarrelConnect migration 029_arenas_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates arenas table for arena finder feature
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  hours JSONB,
  arena_type TEXT NOT NULL DEFAULT 'indoor',
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  pricing JSONB,
  rating DOUBLE PRECISION DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arenas_is_active ON public.arenas(is_active);
CREATE INDEX IF NOT EXISTS idx_arenas_arena_type ON public.arenas(arena_type);
CREATE INDEX IF NOT EXISTS idx_arenas_city_state ON public.arenas(city, state);
CREATE INDEX IF NOT EXISTS idx_arenas_rating ON public.arenas(rating DESC);
CREATE INDEX IF NOT EXISTS idx_arenas_location ON public.arenas(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- RLS policies - arenas are public (anyone can view active ones)
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active arenas" ON public.arenas;
CREATE POLICY "Anyone can view active arenas"
  ON public.arenas FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view all arenas" ON public.arenas;
CREATE POLICY "Authenticated users can view all arenas"
  ON public.arenas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert arenas" ON public.arenas;
CREATE POLICY "Authenticated users can insert arenas"
  ON public.arenas FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update arenas" ON public.arenas;
CREATE POLICY "Authenticated users can update arenas"
  ON public.arenas FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete arenas" ON public.arenas;
CREATE POLICY "Authenticated users can delete arenas"
  ON public.arenas FOR DELETE
  TO authenticated
  USING (true);
