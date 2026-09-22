-- Ported from BarrelConnect migration 031_live_session_messages_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates live_session_messages table for live stream chat
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.live_session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_session_messages_session_id ON public.live_session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_messages_user_id ON public.live_session_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_live_session_messages_created_at ON public.live_session_messages(created_at);

-- RLS policies
ALTER TABLE public.live_session_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view messages for live sessions" ON public.live_session_messages;
CREATE POLICY "Anyone can view messages for live sessions"
  ON public.live_session_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.live_session_messages;
CREATE POLICY "Authenticated users can insert messages"
  ON public.live_session_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.live_session_messages;
CREATE POLICY "Users can delete own messages"
  ON public.live_session_messages FOR DELETE
  USING (auth.uid() = user_id);
