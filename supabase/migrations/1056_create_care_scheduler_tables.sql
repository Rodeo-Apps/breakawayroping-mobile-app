-- Ported from BarrelConnect migration 056_create_care_scheduler_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Care Scheduler tables used by CareSchedulerScreen

CREATE TABLE IF NOT EXISTS public.care_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 60 CHECK (reminder_minutes_before >= 0),
  provider_name TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_templates_user
  ON public.care_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_care_templates_public
  ON public.care_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_care_events_user_date
  ON public.care_events(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_care_events_horse
  ON public.care_events(horse_id);
CREATE INDEX IF NOT EXISTS idx_care_events_status
  ON public.care_events(status);

ALTER TABLE public.care_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or public care templates" ON public.care_templates;
CREATE POLICY "Users can view own or public care templates"
  ON public.care_templates FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create own care templates" ON public.care_templates;
CREATE POLICY "Users can create own care templates"
  ON public.care_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own care templates" ON public.care_templates;
CREATE POLICY "Users can update own care templates"
  ON public.care_templates FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own care templates" ON public.care_templates;
CREATE POLICY "Users can delete own care templates"
  ON public.care_templates FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own care events" ON public.care_events;
CREATE POLICY "Users can view own care events"
  ON public.care_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own care events" ON public.care_events;
CREATE POLICY "Users can create own care events"
  ON public.care_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own care events" ON public.care_events;
CREATE POLICY "Users can update own care events"
  ON public.care_events FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own care events" ON public.care_events;
CREATE POLICY "Users can delete own care events"
  ON public.care_events FOR DELETE
  USING (auth.uid() = user_id);
