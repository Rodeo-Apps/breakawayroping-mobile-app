-- Ported from BarrelConnect migration 005_storage_horse_photos_bucket.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix: "Bucket not found" when uploading horse photos
-- Creates the horse-photos storage bucket and policies so the app can upload/read.
--
-- Run in Supabase Dashboard -> SQL Editor.

-- Create the bucket (public so getPublicUrl works for displaying images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'horse-photos',
  'horse-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: authenticated users upload to their own folder (path: {user_id}/...); anyone can read (public bucket)
DROP POLICY IF EXISTS "horse_photos_upload" ON storage.objects;
CREATE POLICY "horse_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "horse_photos_select" ON storage.objects;
CREATE POLICY "horse_photos_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'horse-photos');

DROP POLICY IF EXISTS "horse_photos_update" ON storage.objects;
CREATE POLICY "horse_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "horse_photos_delete" ON storage.objects;
CREATE POLICY "horse_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
