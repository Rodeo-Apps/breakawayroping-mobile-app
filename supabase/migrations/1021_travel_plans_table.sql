-- Ported from BarrelConnect migration 021_travel_plans_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates travel_plans table for travel planning
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.travel_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_location TEXT NOT NULL,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_location TEXT NOT NULL,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  departure_date TIMESTAMPTZ,
  estimated_arrival_date TIMESTAMPTZ,
  total_distance_miles DOUBLE PRECISION,
  estimated_fuel_cost_cents INTEGER DEFAULT 0,
  event_id UUID, -- FK to events table (add constraint later if events table exists)
  event_name TEXT,
  weather_data JSONB,
  route_data JSONB,
  vehicle_info JSONB,
  travel_status TEXT NOT NULL DEFAULT 'planned',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_travel_plans_user_id ON public.travel_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_plans_departure_date ON public.travel_plans(departure_date);
CREATE INDEX IF NOT EXISTS idx_travel_plans_travel_status ON public.travel_plans(travel_status);
CREATE INDEX IF NOT EXISTS idx_travel_plans_event_id ON public.travel_plans(event_id);

-- Add FK constraint to events table if it exists (run separately if events table is created)
-- ALTER TABLE public.travel_plans ADD CONSTRAINT fk_travel_plans_event 
--   FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

-- RLS policies
ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own travel plans" ON public.travel_plans;
CREATE POLICY "Users can view own travel plans"
  ON public.travel_plans FOR SELECT
  USING (auth.uid() = user_id OR is_shared = true);

DROP POLICY IF EXISTS "Users can insert own travel plans" ON public.travel_plans;
CREATE POLICY "Users can insert own travel plans"
  ON public.travel_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own travel plans" ON public.travel_plans;
CREATE POLICY "Users can update own travel plans"
  ON public.travel_plans FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own travel plans" ON public.travel_plans;
CREATE POLICY "Users can delete own travel plans"
  ON public.travel_plans FOR DELETE
  USING (auth.uid() = user_id);
