-- Ported from BarrelConnect migration 006_runs_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix: "Could not find the 'barrel1_time' column of 'runs' in the schema cache"
-- Creates runs table if missing, or adds barrel split columns to existing runs table.
--
-- Run in Supabase Dashboard -> SQL Editor.

-- Create runs table if it doesn't exist (full schema for new projects)
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  horse_id UUID,
  run_date DATE NOT NULL,
  time_seconds DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete',
  penalties DOUBLE PRECISION DEFAULT 0,
  notes TEXT,
  time_division TEXT,
  event_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns if the table already existed with an older schema
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS horse_id UUID;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS run_date DATE;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS time_seconds DOUBLE PRECISION;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS penalties DOUBLE PRECISION;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS time_division TEXT;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON public.runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_horse_id ON public.runs(horse_id);
CREATE INDEX IF NOT EXISTS idx_runs_run_date ON public.runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON public.runs(created_at DESC);

-- RLS
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own runs" ON public.runs;
CREATE POLICY "Users can view own runs"
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own runs" ON public.runs;
CREATE POLICY "Users can insert own runs"
  ON public.runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own runs" ON public.runs;
CREATE POLICY "Users can update own runs"
  ON public.runs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own runs" ON public.runs;
CREATE POLICY "Users can delete own runs"
  ON public.runs FOR DELETE
  USING (auth.uid() = user_id);
