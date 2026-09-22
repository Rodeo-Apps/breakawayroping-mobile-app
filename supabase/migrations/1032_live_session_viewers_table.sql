-- Ported from BarrelConnect migration 032_live_session_viewers_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates live_session_viewers table for tracking viewers
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.live_session_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_session_viewers_session_id ON public.live_session_viewers(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_viewers_user_id ON public.live_session_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_live_session_viewers_last_seen ON public.live_session_viewers(last_seen);

-- RLS policies
ALTER TABLE public.live_session_viewers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view viewers for live sessions" ON public.live_session_viewers;
CREATE POLICY "Anyone can view viewers for live sessions"
  ON public.live_session_viewers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert/update own viewer records" ON public.live_session_viewers;
CREATE POLICY "Authenticated users can insert/update own viewer records"
  ON public.live_session_viewers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own viewer records" ON public.live_session_viewers;
CREATE POLICY "Users can delete own viewer records"
  ON public.live_session_viewers FOR DELETE
  USING (auth.uid() = user_id);
