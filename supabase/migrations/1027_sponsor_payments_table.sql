-- Ported from BarrelConnect migration 027_sponsor_payments_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsor_payments table for contract payments
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sponsorship_contracts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_payments_contract_id ON public.sponsor_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_payments_payment_date ON public.sponsor_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sponsor_payments_status ON public.sponsor_payments(status);

-- RLS policies
ALTER TABLE public.sponsor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payments for own contracts" ON public.sponsor_payments;
CREATE POLICY "Users can view payments for own contracts"
  ON public.sponsor_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsor_payments.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert payments for own contracts" ON public.sponsor_payments;
CREATE POLICY "Users can insert payments for own contracts"
  ON public.sponsor_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsor_payments.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update payments for own contracts" ON public.sponsor_payments;
CREATE POLICY "Users can update payments for own contracts"
  ON public.sponsor_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsor_payments.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete payments for own contracts" ON public.sponsor_payments;
CREATE POLICY "Users can delete payments for own contracts"
  ON public.sponsor_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_contracts
      WHERE sponsorship_contracts.id = sponsor_payments.contract_id
      AND sponsorship_contracts.rider_id = auth.uid()
    )
  );
