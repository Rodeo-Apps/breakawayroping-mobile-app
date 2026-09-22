-- Ported from BarrelConnect migration 049_runs_read_for_authenticated.sql
-- Adapted for breakawayroping-mobile-app (targets breakaway_runs, not a cloned runs table).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Allow authenticated users to read breakaway_runs so rider public profiles
-- can show times/stats. Combined (OR) with the existing owner-all policy.

ALTER TABLE public.breakaway_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view breakaway_runs" ON public.breakaway_runs;

CREATE POLICY "Authenticated users can view breakaway_runs"
  ON public.breakaway_runs FOR SELECT
  TO authenticated
  USING (true);
