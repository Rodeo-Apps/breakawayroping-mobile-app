-- Ported from BarrelConnect migration 057_create_emergency_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Emergency & safety tables used by Emergency* screens

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  relationship TEXT,
  email TEXT,
  is_vet BOOLEAN NOT NULL DEFAULT false,
  alert_type TEXT NOT NULL DEFAULT 'both'
    CHECK (alert_type IN ('horse', 'personal', 'both')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  contact_type TEXT NOT NULL DEFAULT 'emergency',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  alert_status TEXT NOT NULL DEFAULT 'active'
    CHECK (alert_status IN ('active', 'responded', 'resolved', 'cancelled')),
  location_address TEXT,
  user_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
  ON public.emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_primary
  ON public.emergency_contacts(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user_created
  ON public.emergency_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status
  ON public.emergency_alerts(alert_status);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can view own emergency contacts"
  ON public.emergency_contacts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can create own emergency contacts"
  ON public.emergency_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can update own emergency contacts"
  ON public.emergency_contacts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can delete own emergency contacts"
  ON public.emergency_contacts FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Users can view own emergency alerts"
  ON public.emergency_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Users can create own emergency alerts"
  ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Users can update own emergency alerts"
  ON public.emergency_alerts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Users can delete own emergency alerts"
  ON public.emergency_alerts FOR DELETE
  USING (auth.uid() = user_id);
