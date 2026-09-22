-- Ported from BarrelConnect migration 055_create_breeding_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Breeding database tables used by BreedingDatabaseScreen

CREATE TABLE IF NOT EXISTS public.horses_breeding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  horse_name TEXT NOT NULL,
  registration_number TEXT,
  breed TEXT,
  color TEXT,
  gender TEXT,
  birth_date DATE,
  sire_name TEXT,
  dam_name TEXT,
  bloodline TEXT,
  is_available_for_stud BOOLEAN NOT NULL DEFAULT false,
  stud_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (stud_fee_cents >= 0),
  temperament_score INTEGER CHECK (temperament_score BETWEEN 0 AND 10),
  speed_rating INTEGER CHECK (speed_rating BETWEEN 0 AND 10),
  agility_rating INTEGER CHECK (agility_rating BETWEEN 0 AND 10),
  offspring_count INTEGER NOT NULL DEFAULT 0 CHECK (offspring_count >= 0),
  location TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.breeding_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES public.horses_breeding(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  recommendations TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horses_breeding_name
  ON public.horses_breeding(horse_name);
CREATE INDEX IF NOT EXISTS idx_horses_breeding_stud
  ON public.horses_breeding(is_available_for_stud);
CREATE INDEX IF NOT EXISTS idx_horses_breeding_owner
  ON public.horses_breeding(owner_id);
CREATE INDEX IF NOT EXISTS idx_breeding_reports_user
  ON public.breeding_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_breeding_reports_generated_at
  ON public.breeding_reports(generated_at DESC);

ALTER TABLE public.horses_breeding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeding_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view breeding horses" ON public.horses_breeding;
CREATE POLICY "Anyone can view breeding horses"
  ON public.horses_breeding FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can create breeding horses" ON public.horses_breeding;
CREATE POLICY "Authenticated can create breeding horses"
  ON public.horses_breeding FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "Owners can update breeding horses" ON public.horses_breeding;
CREATE POLICY "Owners can update breeding horses"
  ON public.horses_breeding FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete breeding horses" ON public.horses_breeding;
CREATE POLICY "Owners can delete breeding horses"
  ON public.horses_breeding FOR DELETE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can view own breeding reports" ON public.breeding_reports;
CREATE POLICY "Users can view own breeding reports"
  ON public.breeding_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own breeding reports" ON public.breeding_reports;
CREATE POLICY "Users can create own breeding reports"
  ON public.breeding_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own breeding reports" ON public.breeding_reports;
CREATE POLICY "Users can update own breeding reports"
  ON public.breeding_reports FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own breeding reports" ON public.breeding_reports;
CREATE POLICY "Users can delete own breeding reports"
  ON public.breeding_reports FOR DELETE
  USING (auth.uid() = user_id);
