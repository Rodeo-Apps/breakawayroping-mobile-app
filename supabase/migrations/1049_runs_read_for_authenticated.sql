-- Ported from BarrelConnect migration 049_runs_read_for_authenticated.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Allow authenticated users to read runs so rider public profiles can show times/stats.

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own runs" ON public.runs;
DROP POLICY IF EXISTS "Authenticated users can view runs" ON public.runs;

CREATE POLICY "Authenticated users can view runs"
  ON public.runs FOR SELECT
  TO authenticated
  USING (true);
