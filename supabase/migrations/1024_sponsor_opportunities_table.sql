-- Ported from BarrelConnect migration 024_sponsor_opportunities_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsor_opportunities table for available sponsorship opportunities
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsor_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  sponsor_industry TEXT,
  opportunity_title TEXT NOT NULL,
  description TEXT,
  value_range_min_cents INTEGER NOT NULL DEFAULT 0,
  value_range_max_cents INTEGER NOT NULL DEFAULT 0,
  requirements TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  application_deadline DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_opportunities_status ON public.sponsor_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_opportunities_sponsor_industry ON public.sponsor_opportunities(sponsor_industry);
CREATE INDEX IF NOT EXISTS idx_sponsor_opportunities_created_at ON public.sponsor_opportunities(created_at DESC);

-- RLS policies - opportunities are public (anyone can view)
ALTER TABLE public.sponsor_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active sponsor opportunities" ON public.sponsor_opportunities;
CREATE POLICY "Anyone can view active sponsor opportunities"
  ON public.sponsor_opportunities FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Authenticated users can view all opportunities" ON public.sponsor_opportunities;
CREATE POLICY "Authenticated users can view all opportunities"
  ON public.sponsor_opportunities FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert sponsor opportunities" ON public.sponsor_opportunities;
CREATE POLICY "Authenticated users can insert sponsor opportunities"
  ON public.sponsor_opportunities FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update sponsor opportunities" ON public.sponsor_opportunities;
CREATE POLICY "Users can update sponsor opportunities"
  ON public.sponsor_opportunities FOR UPDATE
  TO authenticated
  USING (true);
