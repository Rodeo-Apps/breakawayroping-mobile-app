-- Ported from BarrelConnect migration 016_transport_trips_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates transport_trips table for ride sharing
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.transport_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_city TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_state TEXT NOT NULL,
  travel_date DATE NOT NULL,
  departure_time TIME,
  available_spots INTEGER NOT NULL DEFAULT 1,
  total_spots INTEGER NOT NULL DEFAULT 1,
  price_per_horse_cents INTEGER DEFAULT 0,
  trailer_type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transport_trips_driver_id ON public.transport_trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_travel_date ON public.transport_trips(travel_date);
CREATE INDEX IF NOT EXISTS idx_transport_trips_status ON public.transport_trips(status);
CREATE INDEX IF NOT EXISTS idx_transport_trips_origin_state ON public.transport_trips(origin_state);
CREATE INDEX IF NOT EXISTS idx_transport_trips_destination_state ON public.transport_trips(destination_state);

-- RLS policies
ALTER TABLE public.transport_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active trips" ON public.transport_trips;
CREATE POLICY "Anyone can view active trips"
  ON public.transport_trips FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Users can view own trips" ON public.transport_trips;
CREATE POLICY "Users can view own trips"
  ON public.transport_trips FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can insert own trips" ON public.transport_trips;
CREATE POLICY "Users can insert own trips"
  ON public.transport_trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can update own trips" ON public.transport_trips;
CREATE POLICY "Users can update own trips"
  ON public.transport_trips FOR UPDATE
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can delete own trips" ON public.transport_trips;
CREATE POLICY "Users can delete own trips"
  ON public.transport_trips FOR DELETE
  USING (auth.uid() = driver_id);
