-- Ported from BarrelConnect migration 076_storage_hauler_covers_bucket.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Storage bucket for hauler directory cover images (same pattern as listing-photos)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hauler-covers',
  'hauler-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "hauler_covers_upload" ON storage.objects;
CREATE POLICY "hauler_covers_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hauler-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "hauler_covers_select" ON storage.objects;
CREATE POLICY "hauler_covers_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hauler-covers');

DROP POLICY IF EXISTS "hauler_covers_update" ON storage.objects;
CREATE POLICY "hauler_covers_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hauler-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "hauler_covers_delete" ON storage.objects;
CREATE POLICY "hauler_covers_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hauler-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
