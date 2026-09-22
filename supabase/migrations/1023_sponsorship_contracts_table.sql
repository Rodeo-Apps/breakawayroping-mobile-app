-- Ported from BarrelConnect migration 023_sponsorship_contracts_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates sponsorship_contracts table for sponsorship management
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.sponsorship_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  sponsor_contact_name TEXT,
  sponsor_contact_email TEXT,
  sponsor_contact_phone TEXT,
  sponsor_industry TEXT,
  contract_value_cents INTEGER NOT NULL DEFAULT 0,
  contract_start_date DATE NOT NULL,
  contract_end_date DATE NOT NULL,
  payment_schedule TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  contract_terms TEXT,
  contract_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_contracts_rider_id ON public.sponsorship_contracts(rider_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_contracts_status ON public.sponsorship_contracts(status);
CREATE INDEX IF NOT EXISTS idx_sponsorship_contracts_contract_end_date ON public.sponsorship_contracts(contract_end_date);

-- RLS policies
ALTER TABLE public.sponsorship_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sponsorship contracts" ON public.sponsorship_contracts;
CREATE POLICY "Users can view own sponsorship contracts"
  ON public.sponsorship_contracts FOR SELECT
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can insert own sponsorship contracts" ON public.sponsorship_contracts;
CREATE POLICY "Users can insert own sponsorship contracts"
  ON public.sponsorship_contracts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can update own sponsorship contracts" ON public.sponsorship_contracts;
CREATE POLICY "Users can update own sponsorship contracts"
  ON public.sponsorship_contracts FOR UPDATE
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Users can delete own sponsorship contracts" ON public.sponsorship_contracts;
CREATE POLICY "Users can delete own sponsorship contracts"
  ON public.sponsorship_contracts FOR DELETE
  USING (auth.uid() = rider_id);
