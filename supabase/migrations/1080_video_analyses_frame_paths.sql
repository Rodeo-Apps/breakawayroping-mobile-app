-- Ported from BarrelConnect migration 080_video_analyses_frame_paths.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Persist storage paths for extracted analysis frames so they can be deleted with the analysis.
ALTER TABLE public.video_analyses
  ADD COLUMN IF NOT EXISTS analysis_frame_paths TEXT[];

COMMENT ON COLUMN public.video_analyses.analysis_frame_paths IS
  'Object paths in video-frames bucket (same order as uploaded keyframes); used for cleanup on delete.';
