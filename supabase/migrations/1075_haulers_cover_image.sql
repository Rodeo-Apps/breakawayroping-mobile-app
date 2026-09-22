-- Ported from BarrelConnect migration 075_haulers_cover_image.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Hauler directory: optional cover image (public URL from storage)

ALTER TABLE public.haulers
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.haulers.cover_image_url IS 'Public URL for listing cover image (e.g. hauler-covers bucket)';
