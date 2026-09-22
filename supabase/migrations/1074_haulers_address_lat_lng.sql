-- Ported from BarrelConnect migration 074_haulers_address_lat_lng.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Haulers: single formatted address + coordinates (Google Places), city/state optional legacy

ALTER TABLE public.haulers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

COMMENT ON COLUMN public.haulers.address IS 'Formatted address from place picker or legacy display';
COMMENT ON COLUMN public.haulers.latitude IS 'Primary business location latitude';
COMMENT ON COLUMN public.haulers.longitude IS 'Primary business location longitude';
COMMENT ON COLUMN public.haulers.google_place_id IS 'Google Places place id when chosen from autocomplete';

-- Backfill address for existing rows (city + state were required before)
UPDATE public.haulers
SET address = trim(concat_ws(', ', nullif(trim(city), ''), nullif(trim(state), '')))
WHERE address IS NULL
  AND (city IS NOT NULL OR state IS NOT NULL);

-- New listings may omit city/state when address + coords are used
ALTER TABLE public.haulers
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL;
