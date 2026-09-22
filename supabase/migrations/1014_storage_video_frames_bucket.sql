-- Ported from BarrelConnect migration 014_storage_video_frames_bucket.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Bucket for extracted video frames (thumbnails) used in AI analysis.
-- OpenAI Vision API requires images, not video files.
--
-- Run in Supabase Dashboard -> SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-frames',
  'video-frames',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "video_frames_upload" ON storage.objects;
CREATE POLICY "video_frames_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'video-frames' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "video_frames_select" ON storage.objects;
CREATE POLICY "video_frames_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'video-frames');

DROP POLICY IF EXISTS "video_frames_delete" ON storage.objects;
CREATE POLICY "video_frames_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'video-frames' AND (storage.foldername(name))[1] = auth.uid()::text);
