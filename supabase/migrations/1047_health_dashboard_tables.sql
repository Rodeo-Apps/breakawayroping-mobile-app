-- Ported from BarrelConnect migration 047_health_dashboard_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Health dashboard tables used by HealthDashboardScreen

CREATE TABLE IF NOT EXISTS public.horse_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT 'vet_visit',
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  veterinarian_name TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horse_health_records_horse_id
  ON public.horse_health_records(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_health_records_user_id
  ON public.horse_health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_horse_health_records_visit_date
  ON public.horse_health_records(visit_date DESC);

CREATE TABLE IF NOT EXISTS public.medication_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medication_schedules_horse_id
  ON public.medication_schedules(horse_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_user_id
  ON public.medication_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_is_active
  ON public.medication_schedules(is_active);

CREATE TABLE IF NOT EXISTS public.recovery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recovery_stage TEXT,
  stress_level INTEGER,
  activity_level TEXT,
  temperature NUMERIC(5,2),
  heart_rate INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recovery_metrics_stress_level_check
    CHECK (stress_level IS NULL OR (stress_level >= 0 AND stress_level <= 10))
);

CREATE INDEX IF NOT EXISTS idx_recovery_metrics_horse_id
  ON public.recovery_metrics(horse_id);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_user_id
  ON public.recovery_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_metric_date
  ON public.recovery_metrics(metric_date DESC);

CREATE OR REPLACE FUNCTION public.touch_health_dashboard_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_horse_health_records_updated_at ON public.horse_health_records;
CREATE TRIGGER trg_touch_horse_health_records_updated_at
  BEFORE UPDATE ON public.horse_health_records
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_health_dashboard_updated_at();

DROP TRIGGER IF EXISTS trg_touch_medication_schedules_updated_at ON public.medication_schedules;
CREATE TRIGGER trg_touch_medication_schedules_updated_at
  BEFORE UPDATE ON public.medication_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_health_dashboard_updated_at();

DROP TRIGGER IF EXISTS trg_touch_recovery_metrics_updated_at ON public.recovery_metrics;
CREATE TRIGGER trg_touch_recovery_metrics_updated_at
  BEFORE UPDATE ON public.recovery_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_health_dashboard_updated_at();

ALTER TABLE public.horse_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own horse health records" ON public.horse_health_records;
CREATE POLICY "Users can view own horse health records"
  ON public.horse_health_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own horse health records" ON public.horse_health_records;
CREATE POLICY "Users can insert own horse health records"
  ON public.horse_health_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own horse health records" ON public.horse_health_records;
CREATE POLICY "Users can update own horse health records"
  ON public.horse_health_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own horse health records" ON public.horse_health_records;
CREATE POLICY "Users can delete own horse health records"
  ON public.horse_health_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can view own medication schedules"
  ON public.medication_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can insert own medication schedules"
  ON public.medication_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can update own medication schedules"
  ON public.medication_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medication schedules" ON public.medication_schedules;
CREATE POLICY "Users can delete own medication schedules"
  ON public.medication_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Users can view own recovery metrics"
  ON public.recovery_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Users can insert own recovery metrics"
  ON public.recovery_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Users can update own recovery metrics"
  ON public.recovery_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Users can delete own recovery metrics"
  ON public.recovery_metrics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
