-- Ported from BarrelConnect migration 030_live_sessions_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates live_sessions table for live streaming feature
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'live',
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_id ON public.live_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON public.live_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status_started_at ON public.live_sessions(status, started_at DESC);

-- RLS policies
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view live sessions" ON public.live_sessions;
CREATE POLICY "Anyone can view live sessions"
  ON public.live_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own live sessions" ON public.live_sessions;
CREATE POLICY "Users can insert own live sessions"
  ON public.live_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own live sessions" ON public.live_sessions;
CREATE POLICY "Users can update own live sessions"
  ON public.live_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own live sessions" ON public.live_sessions;
CREATE POLICY "Users can delete own live sessions"
  ON public.live_sessions FOR DELETE
  USING (auth.uid() = user_id);
