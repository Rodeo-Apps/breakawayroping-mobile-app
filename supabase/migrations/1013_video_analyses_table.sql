-- Ported from BarrelConnect migration 013_video_analyses_table.sql
-- Adapted for breakawayroping-mobile-app.
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.
--
-- NOTE: breakawayroping already ships its own `video_analyses` table
-- (007_ai_video_analysis.sql), which is the discipline-correct AI analysis
-- store for this app. We therefore DO NOT clone BarrelConnect's incompatible
-- `video_analyses` schema. This migration only adds `video_comparisons`
-- (side-by-side comparison feature), referencing the existing video_analyses.

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
