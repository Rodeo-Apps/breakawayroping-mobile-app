-- Ported from BarrelConnect migration 073_rodeo_events_cover_image.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Event cover image (public URL after upload to event-covers bucket)

ALTER TABLE public.rodeo_events
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.rodeo_events.cover_image_url IS 'Public URL for cover image (event-covers storage)';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-covers',
  'event-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "event_covers_upload" ON storage.objects;
CREATE POLICY "event_covers_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "event_covers_select" ON storage.objects;
CREATE POLICY "event_covers_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-covers');

DROP POLICY IF EXISTS "event_covers_update" ON storage.objects;
CREATE POLICY "event_covers_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "event_covers_delete" ON storage.objects;
CREATE POLICY "event_covers_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
