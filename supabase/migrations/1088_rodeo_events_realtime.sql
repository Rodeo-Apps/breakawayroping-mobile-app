-- Ported from BarrelConnect migration 088_rodeo_events_realtime.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 088_rodeo_events_realtime.sql
-- Quick Win #5: LIVE event badge
--
-- The events list subscribes to realtime UPDATEs on rodeo_events so the LIVE
-- badge appears/disappears the moment a producer toggles `is_live`. For the
-- client subscription to receive change events, the table must belong to the
-- `supabase_realtime` publication and have full replica identity.
-- (`is_live` already exists — see 035_rodeo_events_is_live.sql.)
-- ============================================================================

-- Emit complete row data on UPDATE so clients see the changed columns.
ALTER TABLE public.rodeo_events REPLICA IDENTITY FULL;

-- Add the table to the realtime publication (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rodeo_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rodeo_events;
  END IF;
END
$$;
