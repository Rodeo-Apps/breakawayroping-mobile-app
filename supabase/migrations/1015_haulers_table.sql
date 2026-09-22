-- Ported from BarrelConnect migration 015_haulers_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates haulers table for the hauling directory
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.haulers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  service_area_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trailer_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  capacity INTEGER NOT NULL DEFAULT 1,
  price_range TEXT NOT NULL DEFAULT 'low',
  average_rating DOUBLE PRECISION DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  phone_number TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_haulers_state ON public.haulers(state);
CREATE INDEX IF NOT EXISTS idx_haulers_city ON public.haulers(city);
CREATE INDEX IF NOT EXISTS idx_haulers_is_active ON public.haulers(is_active);
CREATE INDEX IF NOT EXISTS idx_haulers_average_rating ON public.haulers(average_rating DESC);

-- RLS policies
ALTER TABLE public.haulers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active haulers" ON public.haulers;
CREATE POLICY "Anyone can view active haulers"
  ON public.haulers FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can insert haulers" ON public.haulers;
CREATE POLICY "Authenticated users can insert haulers"
  ON public.haulers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own haulers" ON public.haulers;
CREATE POLICY "Users can update own haulers"
  ON public.haulers FOR UPDATE
  TO authenticated
  USING (true); -- In production, add owner_id column and check ownership
