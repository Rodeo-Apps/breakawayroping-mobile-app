-- Ported from BarrelConnect migration 011_runs_horse_fk.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Adds foreign key from runs.horse_id to horses.id
-- This enables PostgREST joins like: .select('*, horses(name)')
-- Run in Supabase Dashboard -> SQL Editor

-- First, clean up any orphaned horse_id references (runs pointing to deleted horses)
UPDATE public.runs
SET horse_id = NULL
WHERE horse_id IS NOT NULL
  AND horse_id NOT IN (SELECT id FROM public.horses);

-- Add the foreign key constraint
ALTER TABLE public.runs
  DROP CONSTRAINT IF EXISTS fk_runs_horse;

ALTER TABLE public.runs
  ADD CONSTRAINT fk_runs_horse
  FOREIGN KEY (horse_id)
  REFERENCES public.horses(id)
  ON DELETE SET NULL;
