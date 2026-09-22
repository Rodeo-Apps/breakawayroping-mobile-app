-- Ported from BarrelConnect migration 018_rider_nutrition_logs_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates rider_nutrition_logs table for tracking rider nutrition
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.rider_nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  log_time TIME,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'meal',
  calories INTEGER DEFAULT 0,
  protein_grams DOUBLE PRECISION DEFAULT 0,
  carbs_grams DOUBLE PRECISION DEFAULT 0,
  fat_grams DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rider_nutrition_logs_user_id ON public.rider_nutrition_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_nutrition_logs_log_date ON public.rider_nutrition_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_rider_nutrition_logs_user_date ON public.rider_nutrition_logs(user_id, log_date DESC);

-- RLS policies
ALTER TABLE public.rider_nutrition_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rider nutrition logs" ON public.rider_nutrition_logs;
CREATE POLICY "Users can view own rider nutrition logs"
  ON public.rider_nutrition_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own rider nutrition logs" ON public.rider_nutrition_logs;
CREATE POLICY "Users can insert own rider nutrition logs"
  ON public.rider_nutrition_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rider nutrition logs" ON public.rider_nutrition_logs;
CREATE POLICY "Users can update own rider nutrition logs"
  ON public.rider_nutrition_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own rider nutrition logs" ON public.rider_nutrition_logs;
CREATE POLICY "Users can delete own rider nutrition logs"
  ON public.rider_nutrition_logs FOR DELETE
  USING (auth.uid() = user_id);
