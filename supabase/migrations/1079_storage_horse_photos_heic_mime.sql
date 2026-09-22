-- Ported from BarrelConnect migration 079_storage_horse_photos_heic_mime.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Allow HEIC/HEIF uploads to horse-photos (iOS library); keeps existing types.
-- Run in Supabase SQL Editor if migrations are applied manually.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
WHERE id = 'horse-photos';
