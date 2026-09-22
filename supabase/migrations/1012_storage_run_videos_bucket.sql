-- Ported from BarrelConnect migration 012_storage_run_videos_bucket.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix: "Bucket not found" when attaching video to run
-- Creates the run-videos storage bucket for run video uploads.
--
-- Run in Supabase Dashboard -> SQL Editor.

-- Create the bucket (public so getPublicUrl works for playback)
-- 100 MB max per file; MP4, MOV, M4V allowed
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'run-videos',
  'run-videos',
  true,
  104857600,
  ARRAY['video/mp4', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: authenticated users upload to their own folder (path: {user_id}/...)
DROP POLICY IF EXISTS "run_videos_upload" ON storage.objects;
CREATE POLICY "run_videos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'run-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "run_videos_select" ON storage.objects;
CREATE POLICY "run_videos_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'run-videos');

DROP POLICY IF EXISTS "run_videos_update" ON storage.objects;
CREATE POLICY "run_videos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'run-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "run_videos_delete" ON storage.objects;
CREATE POLICY "run_videos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'run-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
