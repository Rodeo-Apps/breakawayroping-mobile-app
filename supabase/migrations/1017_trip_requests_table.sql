-- Ported from BarrelConnect migration 017_trip_requests_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates trip_requests table for trip join requests
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.trip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  num_horses INTEGER NOT NULL DEFAULT 1,
  horse_details JSONB,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, requester_id) -- Prevent duplicate requests
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_requests_trip_id ON public.trip_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_requests_requester_id ON public.trip_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trip_requests_status ON public.trip_requests(status);
CREATE INDEX IF NOT EXISTS idx_trip_requests_created_at ON public.trip_requests(created_at DESC);

-- RLS policies
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trip requests" ON public.trip_requests;
CREATE POLICY "Users can view own trip requests"
  ON public.trip_requests FOR SELECT
  USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Trip drivers can view requests for their trips" ON public.trip_requests;
CREATE POLICY "Trip drivers can view requests for their trips"
  ON public.trip_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_trips
      WHERE transport_trips.id = trip_requests.trip_id
      AND transport_trips.driver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own trip requests" ON public.trip_requests;
CREATE POLICY "Users can insert own trip requests"
  ON public.trip_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Trip drivers can update requests for their trips" ON public.trip_requests;
CREATE POLICY "Trip drivers can update requests for their trips"
  ON public.trip_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_trips
      WHERE transport_trips.id = trip_requests.trip_id
      AND transport_trips.driver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own trip requests" ON public.trip_requests;
CREATE POLICY "Users can delete own trip requests"
  ON public.trip_requests FOR DELETE
  USING (auth.uid() = requester_id);
