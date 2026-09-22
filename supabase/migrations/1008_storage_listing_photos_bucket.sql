-- Ported from BarrelConnect migration 008_storage_listing_photos_bucket.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Listing photos bucket (max 5 MB per file, for marketplace listing images)
-- Run in Supabase Dashboard -> SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "listing_photos_upload" ON storage.objects;
CREATE POLICY "listing_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "listing_photos_select" ON storage.objects;
CREATE POLICY "listing_photos_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'listing-photos');

DROP POLICY IF EXISTS "listing_photos_update" ON storage.objects;
CREATE POLICY "listing_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "listing_photos_delete" ON storage.objects;
CREATE POLICY "listing_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
