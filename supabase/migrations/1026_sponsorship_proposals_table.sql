-- Ported from BarrelConnect migration 026_sponsorship_proposals_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsorship_proposals table for sponsorship proposals
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsorship_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sponsor_opportunity_id UUID REFERENCES public.sponsor_opportunities(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_industry TEXT,
  proposal_title TEXT NOT NULL,
  proposal_description TEXT NOT NULL,
  requested_value_cents INTEGER NOT NULL DEFAULT 0,
  proposed_deliverables TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  response_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_proposals_rider_id ON public.sponsorship_proposals(rider_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_proposals_sponsor_opportunity_id ON public.sponsorship_proposals(sponsor_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_proposals_status ON public.sponsorship_proposals(status);
CREATE INDEX IF NOT EXISTS idx_sponsorship_proposals_submitted_at ON public.sponsorship_proposals(submitted_at DESC);

-- RLS policies
ALTER TABLE public.sponsorship_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sponsorship proposals" ON public.sponsorship_proposals;
CREATE POLICY "Users can view own sponsorship proposals"
  ON public.sponsorship_proposals FOR SELECT
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can insert own sponsorship proposals" ON public.sponsorship_proposals;
CREATE POLICY "Users can insert own sponsorship proposals"
  ON public.sponsorship_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can update own sponsorship proposals" ON public.sponsorship_proposals;
CREATE POLICY "Users can update own sponsorship proposals"
  ON public.sponsorship_proposals FOR UPDATE
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can delete own sponsorship proposals" ON public.sponsorship_proposals;
CREATE POLICY "Users can delete own sponsorship proposals"
  ON public.sponsorship_proposals FOR DELETE
  USING (auth.uid() = rider_id);
