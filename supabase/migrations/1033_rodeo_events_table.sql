-- Ported from BarrelConnect migration 033_rodeo_events_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates rodeo_events table for events/rodeo feature
-- Referenced by draw_positions, travel_plans, and app screens (Home, EventDetails, etc.)

CREATE TABLE IF NOT EXISTS public.rodeo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  name TEXT,
  event_type TEXT DEFAULT 'jackpot',
  organization TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  date DATE,
  location_name TEXT,
  address TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  entry_fee NUMERIC(10, 2),
  max_entries INTEGER,
  prize_pool_cents BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  country TEXT DEFAULT 'USA',
  currency TEXT DEFAULT 'USD',
  payout_structure JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Keep date in sync with start_date for queries like .gte('date', ...)
CREATE OR REPLACE FUNCTION public.rodeo_events_set_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date := (NEW.start_date AT TIME ZONE 'UTC')::DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_rodeo_events_date ON public.rodeo_events;
CREATE TRIGGER set_rodeo_events_date
  BEFORE INSERT OR UPDATE OF start_date ON public.rodeo_events
  FOR EACH ROW EXECUTE PROCEDURE public.rodeo_events_set_date();

-- Backfill date for existing rows (no-op on fresh install)
UPDATE public.rodeo_events SET updated_at = now() WHERE date IS NULL AND start_date IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rodeo_events_producer_id ON public.rodeo_events(producer_id);
CREATE INDEX IF NOT EXISTS idx_rodeo_events_start_date ON public.rodeo_events(start_date);
CREATE INDEX IF NOT EXISTS idx_rodeo_events_date ON public.rodeo_events(date);
CREATE INDEX IF NOT EXISTS idx_rodeo_events_status ON public.rodeo_events(status);
CREATE INDEX IF NOT EXISTS idx_rodeo_events_event_name ON public.rodeo_events(event_name);

-- RLS
ALTER TABLE public.rodeo_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published rodeo events" ON public.rodeo_events;
CREATE POLICY "Anyone can view published rodeo events"
  ON public.rodeo_events FOR SELECT
  USING (status = 'published' OR auth.uid() = producer_id);

DROP POLICY IF EXISTS "Producers can insert own rodeo events" ON public.rodeo_events;
CREATE POLICY "Producers can insert own rodeo events"
  ON public.rodeo_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = producer_id);

DROP POLICY IF EXISTS "Producers can update own rodeo events" ON public.rodeo_events;
CREATE POLICY "Producers can update own rodeo events"
  ON public.rodeo_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = producer_id);

DROP POLICY IF EXISTS "Producers can delete own rodeo events" ON public.rodeo_events;
CREATE POLICY "Producers can delete own rodeo events"
  ON public.rodeo_events FOR DELETE
  TO authenticated
  USING (auth.uid() = producer_id);
