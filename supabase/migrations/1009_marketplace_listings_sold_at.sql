-- Ported from BarrelConnect migration 009_marketplace_listings_sold_at.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Add sold_at to marketplace_listings (for "Mark as Sold")
-- Run in Supabase Dashboard -> SQL Editor if the table already exists without this column.

ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;
