-- Ported from BarrelConnect migration 077_transport_trips_addresses.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Trip endpoints: full address + coordinates from Google Places (city/state optional legacy)

ALTER TABLE public.transport_trips
  ADD COLUMN IF NOT EXISTS origin_address TEXT,
  ADD COLUMN IF NOT EXISTS origin_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_address TEXT,
  ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_google_place_id TEXT;

ALTER TABLE public.transport_trips
  ALTER COLUMN origin_city DROP NOT NULL,
  ALTER COLUMN origin_state DROP NOT NULL,
  ALTER COLUMN destination_city DROP NOT NULL,
  ALTER COLUMN destination_state DROP NOT NULL;

COMMENT ON COLUMN public.transport_trips.origin_address IS 'Formatted address from Places (preferred for display)';
COMMENT ON COLUMN public.transport_trips.destination_address IS 'Formatted address from Places (preferred for display)';
