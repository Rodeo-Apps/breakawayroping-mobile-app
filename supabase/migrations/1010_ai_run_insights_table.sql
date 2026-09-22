-- Ported from BarrelConnect migration 010_ai_run_insights_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates ai_run_insights table for storing AI-generated coaching insights
-- Run in Supabase Dashboard -> SQL Editor or via CLI

CREATE TABLE IF NOT EXISTS public.ai_run_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.breakaway_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insight_text TEXT NOT NULL,
  insight_type TEXT NOT NULL DEFAULT 'general',
  confidence_score DOUBLE PRECISION,
  analysis_data JSONB,
  tokens_used INTEGER,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_run_insights_run_id ON public.ai_run_insights(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_run_insights_user_id ON public.ai_run_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_run_insights_created_at ON public.ai_run_insights(created_at DESC);

-- RLS policies
ALTER TABLE public.ai_run_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own insights" ON public.ai_run_insights;
CREATE POLICY "Users can view own insights"
  ON public.ai_run_insights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own insights" ON public.ai_run_insights;
CREATE POLICY "Users can insert own insights"
  ON public.ai_run_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own insights" ON public.ai_run_insights;
CREATE POLICY "Users can delete own insights"
  ON public.ai_run_insights FOR DELETE
  USING (auth.uid() = user_id);

-- Grant service role access (needed for Edge Function with service role key)
GRANT ALL ON public.ai_run_insights TO service_role;
