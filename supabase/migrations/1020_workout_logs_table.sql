-- Ported from BarrelConnect migration 020_workout_logs_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates workout_logs table for tracking workouts
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,
  workout_time TIME,
  workout_for TEXT NOT NULL DEFAULT 'rider',
  workout_type TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  intensity TEXT DEFAULT 'moderate',
  calories_burned INTEGER DEFAULT 0,
  horse_name TEXT,
  horse_id UUID REFERENCES public.horses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_workout_date ON public.workout_logs(workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_horse_id ON public.workout_logs(horse_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON public.workout_logs(user_id, workout_date DESC);

-- RLS policies
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout logs" ON public.workout_logs;
CREATE POLICY "Users can view own workout logs"
  ON public.workout_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workout logs" ON public.workout_logs;
CREATE POLICY "Users can insert own workout logs"
  ON public.workout_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workout logs" ON public.workout_logs;
CREATE POLICY "Users can update own workout logs"
  ON public.workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workout logs" ON public.workout_logs;
CREATE POLICY "Users can delete own workout logs"
  ON public.workout_logs FOR DELETE
  USING (auth.uid() = user_id);
