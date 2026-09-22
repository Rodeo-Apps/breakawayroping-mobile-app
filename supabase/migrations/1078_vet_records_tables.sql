-- Ported from BarrelConnect migration 078_vet_records_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Veterinary records (VetRecordsScreen): contacts, visits, vaccinations, documents.
-- Fixes PGRST205: Could not find the table 'public.vaccinations'

-- ---------------------------------------------------------------------------
-- vet_contacts: veterinarians saved by the user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vet_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  clinic_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  specialty TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_contacts_user_id ON public.vet_contacts(user_id);

-- ---------------------------------------------------------------------------
-- vet_visits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vet_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  reason TEXT NOT NULL,
  diagnosis TEXT,
  treatment TEXT,
  notes TEXT,
  cost NUMERIC(12, 2),
  follow_up_date DATE,
  vet_contact_id UUID REFERENCES public.vet_contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_visits_horse_id ON public.vet_visits(horse_id);
CREATE INDEX IF NOT EXISTS idx_vet_visits_user_id ON public.vet_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_vet_visits_visit_date ON public.vet_visits(visit_date DESC);

-- ---------------------------------------------------------------------------
-- vaccinations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  vaccine_type TEXT DEFAULT 'Core',
  date_administered DATE NOT NULL,
  next_due_date DATE NOT NULL,
  lot_number TEXT,
  notes TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  vet_contact_id UUID REFERENCES public.vet_contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaccinations_horse_id ON public.vaccinations(horse_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_user_id ON public.vaccinations(user_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_next_due_date ON public.vaccinations(next_due_date);

-- ---------------------------------------------------------------------------
-- vet_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vet_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_url TEXT,
  issue_date DATE NOT NULL,
  expiration_date DATE,
  issuing_vet TEXT,
  notes TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_documents_horse_id ON public.vet_documents(horse_id);
CREATE INDEX IF NOT EXISTS idx_vet_documents_user_id ON public.vet_documents(user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.vet_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_documents ENABLE ROW LEVEL SECURITY;

-- vet_contacts
DROP POLICY IF EXISTS "vet_contacts_select_own" ON public.vet_contacts;
CREATE POLICY "vet_contacts_select_own"
  ON public.vet_contacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_contacts_insert_own" ON public.vet_contacts;
CREATE POLICY "vet_contacts_insert_own"
  ON public.vet_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_contacts_update_own" ON public.vet_contacts;
CREATE POLICY "vet_contacts_update_own"
  ON public.vet_contacts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_contacts_delete_own" ON public.vet_contacts;
CREATE POLICY "vet_contacts_delete_own"
  ON public.vet_contacts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- vet_visits
DROP POLICY IF EXISTS "vet_visits_select_own" ON public.vet_visits;
CREATE POLICY "vet_visits_select_own"
  ON public.vet_visits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_visits_insert_own" ON public.vet_visits;
CREATE POLICY "vet_visits_insert_own"
  ON public.vet_visits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_visits_update_own" ON public.vet_visits;
CREATE POLICY "vet_visits_update_own"
  ON public.vet_visits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_visits_delete_own" ON public.vet_visits;
CREATE POLICY "vet_visits_delete_own"
  ON public.vet_visits FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- vaccinations
DROP POLICY IF EXISTS "vaccinations_select_own" ON public.vaccinations;
CREATE POLICY "vaccinations_select_own"
  ON public.vaccinations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vaccinations_insert_own" ON public.vaccinations;
CREATE POLICY "vaccinations_insert_own"
  ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vaccinations_update_own" ON public.vaccinations;
CREATE POLICY "vaccinations_update_own"
  ON public.vaccinations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vaccinations_delete_own" ON public.vaccinations;
CREATE POLICY "vaccinations_delete_own"
  ON public.vaccinations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- vet_documents
DROP POLICY IF EXISTS "vet_documents_select_own" ON public.vet_documents;
CREATE POLICY "vet_documents_select_own"
  ON public.vet_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_documents_insert_own" ON public.vet_documents;
CREATE POLICY "vet_documents_insert_own"
  ON public.vet_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_documents_update_own" ON public.vet_documents;
CREATE POLICY "vet_documents_update_own"
  ON public.vet_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "vet_documents_delete_own" ON public.vet_documents;
CREATE POLICY "vet_documents_delete_own"
  ON public.vet_documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
