-- Ported from BarrelConnect migration 070_marketplace_listing_address_latlng.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Marketplace: formatted address + coordinates (Google Places)

ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.marketplace_listings.location_address IS 'Formatted address from place picker';
COMMENT ON COLUMN public.marketplace_listings.latitude IS 'Listing location latitude';
COMMENT ON COLUMN public.marketplace_listings.longitude IS 'Listing location longitude';
