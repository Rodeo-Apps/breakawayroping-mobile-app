-- Ported from BarrelConnect migration 035_rodeo_events_is_live.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Add is_live column for Live Results screen (filter events that are currently live)
ALTER TABLE public.rodeo_events
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rodeo_events_is_live
  ON public.rodeo_events(is_live) WHERE is_live = true;
