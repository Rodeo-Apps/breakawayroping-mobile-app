-- Ported from BarrelConnect migration 081_crhsr_core_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- CR/HSR core schema (isolated)
-- Creates schools, school_staff, and athlete_school_affiliations with RLS.

CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('college', 'high_school')),
  colors TEXT,
  mascot TEXT,
  region TEXT,
  association TEXT,
  state TEXT,
  city TEXT,
  country TEXT DEFAULT 'US',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type, state)
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_schools_type ON public.schools(type);
CREATE INDEX IF NOT EXISTS idx_schools_state ON public.schools(state);
CREATE INDEX IF NOT EXISTS idx_schools_association ON public.schools(association);
CREATE INDEX IF NOT EXISTS idx_schools_name ON public.schools(name);
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm ON public.schools USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.school_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'assistant_coach', 'admin', 'staff')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_school_staff_school_id ON public.school_staff(school_id);
CREATE INDEX IF NOT EXISTS idx_school_staff_user_id ON public.school_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_school_staff_verified_role ON public.school_staff(is_verified, role);

CREATE TABLE IF NOT EXISTS public.athlete_school_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliations_athlete_id ON public.athlete_school_affiliations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_school_id ON public.athlete_school_affiliations(school_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_status ON public.athlete_school_affiliations(status);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_set_updated_at ON public.schools;
CREATE TRIGGER trg_schools_set_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_school_staff_set_updated_at ON public.school_staff;
CREATE TRIGGER trg_school_staff_set_updated_at
BEFORE UPDATE ON public.school_staff
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_athlete_school_affiliations_set_updated_at ON public.athlete_school_affiliations;
CREATE TRIGGER trg_athlete_school_affiliations_set_updated_at
BEFORE UPDATE ON public.athlete_school_affiliations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.is_verified_school_staff(target_school_id UUID, target_roles TEXT[] DEFAULT ARRAY['coach', 'assistant_coach', 'admin'])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_staff ss
    WHERE ss.school_id = target_school_id
      AND ss.user_id = auth.uid()
      AND ss.is_verified = true
      AND ss.role = ANY(target_roles)
  );
$$;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_school_affiliations ENABLE ROW LEVEL SECURITY;

-- schools policies: public read, verified school staff can manage
DROP POLICY IF EXISTS "Schools are publicly readable" ON public.schools;
CREATE POLICY "Schools are publicly readable"
ON public.schools
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Verified school staff can update schools" ON public.schools;
CREATE POLICY "Verified school staff can update schools"
ON public.schools
FOR UPDATE
TO authenticated
USING (public.is_verified_school_staff(id))
WITH CHECK (public.is_verified_school_staff(id));

DROP POLICY IF EXISTS "Verified school staff can delete schools" ON public.schools;
CREATE POLICY "Verified school staff can delete schools"
ON public.schools
FOR DELETE
TO authenticated
USING (public.is_verified_school_staff(id, ARRAY['admin']));

-- school_staff policies
DROP POLICY IF EXISTS "Users can view school staff" ON public.school_staff;
CREATE POLICY "Users can view school staff"
ON public.school_staff
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Verified school admins can manage staff" ON public.school_staff;
CREATE POLICY "Verified school admins can manage staff"
ON public.school_staff
FOR ALL
TO authenticated
USING (public.is_verified_school_staff(school_id, ARRAY['admin']))
WITH CHECK (public.is_verified_school_staff(school_id, ARRAY['admin']));

-- athlete_school_affiliations policies
DROP POLICY IF EXISTS "Users can view approved athlete affiliations" ON public.athlete_school_affiliations;
CREATE POLICY "Users can view approved athlete affiliations"
ON public.athlete_school_affiliations
FOR SELECT
USING (
  status = 'approved'
  OR athlete_id = auth.uid()
  OR public.is_verified_school_staff(school_id)
);

DROP POLICY IF EXISTS "Athletes can create own affiliations" ON public.athlete_school_affiliations;
CREATE POLICY "Athletes can create own affiliations"
ON public.athlete_school_affiliations
FOR INSERT
TO authenticated
WITH CHECK (
  athlete_id = auth.uid()
  AND status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

DROP POLICY IF EXISTS "Athletes can delete pending own affiliations" ON public.athlete_school_affiliations;
CREATE POLICY "Athletes can delete pending own affiliations"
ON public.athlete_school_affiliations
FOR DELETE
TO authenticated
USING (
  athlete_id = auth.uid()
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Verified school staff can approve affiliations" ON public.athlete_school_affiliations;
CREATE POLICY "Verified school staff can approve affiliations"
ON public.athlete_school_affiliations
FOR UPDATE
TO authenticated
USING (public.is_verified_school_staff(school_id))
WITH CHECK (
  public.is_verified_school_staff(school_id)
  AND (
    status <> 'approved'
    OR approved_by = auth.uid()
  )
);
