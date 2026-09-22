-- Ported from BarrelConnect migration 013_video_analyses_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix: "Could not find the table 'public.video_analyses' in the schema cache"
-- Creates video_analyses and video_comparisons tables for run video analysis.
--
-- Run in Supabase Dashboard -> SQL Editor.

-- video_analyses: stores uploaded videos and AI analysis results
CREATE TABLE IF NOT EXISTS public.video_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  video_duration_seconds DOUBLE PRECISION,
  ai_insights JSONB,
  performance_metrics JSONB,
  key_moments JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_analyses_user_id ON public.video_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_run_id ON public.video_analyses(run_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_created_at ON public.video_analyses(created_at DESC);

ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own video analyses" ON public.video_analyses;
CREATE POLICY "Users can view own video analyses"
  ON public.video_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own video analyses" ON public.video_analyses;
CREATE POLICY "Users can insert own video analyses"
  ON public.video_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own video analyses" ON public.video_analyses;
CREATE POLICY "Users can update own video analyses"
  ON public.video_analyses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own video analyses" ON public.video_analyses;
CREATE POLICY "Users can delete own video analyses"
  ON public.video_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- video_comparisons: stores side-by-side video comparisons
CREATE TABLE IF NOT EXISTS public.video_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  video_analysis_1_id UUID NOT NULL REFERENCES public.video_analyses(id) ON DELETE CASCADE,
  video_analysis_2_id UUID NOT NULL REFERENCES public.video_analyses(id) ON DELETE CASCADE,
  comparison_type TEXT NOT NULL DEFAULT 'side_by_side',
  performance_diff JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_comparisons_user_id ON public.video_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_video_comparisons_created_at ON public.video_comparisons(created_at DESC);

ALTER TABLE public.video_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own video comparisons" ON public.video_comparisons;
CREATE POLICY "Users can view own video comparisons"
  ON public.video_comparisons FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own video comparisons" ON public.video_comparisons;
CREATE POLICY "Users can insert own video comparisons"
  ON public.video_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own video comparisons" ON public.video_comparisons;
CREATE POLICY "Users can delete own video comparisons"
  ON public.video_comparisons FOR DELETE
  USING (auth.uid() = user_id);
