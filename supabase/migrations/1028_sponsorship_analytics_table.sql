-- Ported from BarrelConnect migration 028_sponsorship_analytics_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsorship_analytics table for contract analytics/metrics
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsorship_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sponsorship_contracts(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  metric_period TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_analytics_contract_id ON public.sponsorship_analytics(contract_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_analytics_recorded_at ON public.sponsorship_analytics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsorship_analytics_metric_type ON public.sponsorship_analytics(metric_type);

-- RLS policies
ALTER TABLE public.sponsorship_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view analytics for own contracts" ON public.sponsorship_analytics;
CREATE POLICY "Users can view analytics for own contracts"
  ON public.sponsorship_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_analytics.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert analytics for own contracts" ON public.sponsorship_analytics;
CREATE POLICY "Users can insert analytics for own contracts"
  ON public.sponsorship_analytics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_analytics.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update analytics for own contracts" ON public.sponsorship_analytics;
CREATE POLICY "Users can update analytics for own contracts"
  ON public.sponsorship_analytics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_analytics.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete analytics for own contracts" ON public.sponsorship_analytics;
CREATE POLICY "Users can delete analytics for own contracts"
  ON public.sponsorship_analytics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_analytics.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );
