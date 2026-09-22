-- Ported from BarrelConnect migration 025_sponsorship_deliverables_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsorship_deliverables table for contract deliverables
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsorship_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sponsorship_contracts(id) ON DELETE CASCADE,
  deliverable_name TEXT NOT NULL,
  deliverable_type TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_date DATE,
  quantity_required INTEGER DEFAULT 1,
  quantity_completed INTEGER DEFAULT 0,
  proof_url TEXT,
  proof_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_deliverables_contract_id ON public.sponsorship_deliverables(contract_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_deliverables_due_date ON public.sponsorship_deliverables(due_date);
CREATE INDEX IF NOT EXISTS idx_sponsorship_deliverables_status ON public.sponsorship_deliverables(status);

-- RLS policies
ALTER TABLE public.sponsorship_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view deliverables for own contracts" ON public.sponsorship_deliverables;
CREATE POLICY "Users can view deliverables for own contracts"
  ON public.sponsorship_deliverables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_deliverables.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert deliverables for own contracts" ON public.sponsorship_deliverables;
CREATE POLICY "Users can insert deliverables for own contracts"
  ON public.sponsorship_deliverables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_deliverables.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update deliverables for own contracts" ON public.sponsorship_deliverables;
CREATE POLICY "Users can update deliverables for own contracts"
  ON public.sponsorship_deliverables FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_deliverables.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete deliverables for own contracts" ON public.sponsorship_deliverables;
CREATE POLICY "Users can delete deliverables for own contracts"
  ON public.sponsorship_deliverables FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsorship_deliverables.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );
