-- Ported from BarrelConnect migration 022_travel_stops_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates travel_stops table for travel plan stops
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.travel_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_plan_id UUID NOT NULL REFERENCES public.travel_plans(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 1,
  stop_type TEXT NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  estimated_arrival TIMESTAMPTZ,
  estimated_duration_minutes INTEGER DEFAULT 30,
  notes TEXT,
  cost_estimate_cents INTEGER DEFAULT 0,
  actual_cost_cents INTEGER,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_travel_stops_travel_plan_id ON public.travel_stops(travel_plan_id);
CREATE INDEX IF NOT EXISTS idx_travel_stops_stop_order ON public.travel_stops(travel_plan_id, stop_order);

-- RLS policies
ALTER TABLE public.travel_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view stops for own travel plans" ON public.travel_stops;
CREATE POLICY "Users can view stops for own travel plans"
  ON public.travel_stops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_plans
      WHERE travel_plans.id = travel_stops.travel_plan_id
      AND (travel_plans.user_id = auth.uid() OR travel_plans.is_shared = true)
    )
  );

DROP POLICY IF EXISTS "Users can insert stops for own travel plans" ON public.travel_stops;
CREATE POLICY "Users can insert stops for own travel plans"
  ON public.travel_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.travel_plans
      WHERE travel_plans.id = travel_stops.travel_plan_id
      AND travel_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update stops for own travel plans" ON public.travel_stops;
CREATE POLICY "Users can update stops for own travel plans"
  ON public.travel_stops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_plans
      WHERE travel_plans.id = travel_stops.travel_plan_id
      AND travel_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete stops for own travel plans" ON public.travel_stops;
CREATE POLICY "Users can delete stops for own travel plans"
  ON public.travel_stops FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_plans
      WHERE travel_plans.id = travel_stops.travel_plan_id
      AND travel_plans.user_id = auth.uid()
    )
  );
