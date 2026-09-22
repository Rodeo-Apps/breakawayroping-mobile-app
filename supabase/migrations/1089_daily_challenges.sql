-- Ported from BarrelConnect migration 089_daily_challenges.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 089_daily_challenges.sql
-- Quick Win #6: Daily challenges
--
-- A lightweight, single-per-day engagement challenge ("Log a run today",
-- "Share a photo of your horse", etc). One challenge is active per calendar
-- day; users mark it complete. Distinct from the existing community_challenges
-- system (048) which models longer multi-day community competitions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  points         INTEGER NOT NULL DEFAULT 10,
  challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one challenge per calendar day.
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_challenges_date
  ON public.daily_challenges(challenge_date);

CREATE TABLE IF NOT EXISTS public.user_challenge_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_challenge_completions_user
  ON public.user_challenge_completions(user_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Challenges are readable by everyone signed in.
DROP POLICY IF EXISTS "Daily challenges are readable" ON public.daily_challenges;
CREATE POLICY "Daily challenges are readable"
  ON public.daily_challenges FOR SELECT
  TO authenticated
  USING (true);

-- Completions: a user can read/insert/delete only their own.
DROP POLICY IF EXISTS "Users read own completions" ON public.user_challenge_completions;
CREATE POLICY "Users read own completions"
  ON public.user_challenge_completions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own completions" ON public.user_challenge_completions;
CREATE POLICY "Users insert own completions"
  ON public.user_challenge_completions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own completions" ON public.user_challenge_completions;
CREATE POLICY "Users delete own completions"
  ON public.user_challenge_completions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Seed a small pool so the app has a challenge on day one even before the
-- generator Edge Function runs. Uses ON CONFLICT to stay idempotent.
-- ----------------------------------------------------------------------------
INSERT INTO public.daily_challenges (title, description, points, challenge_date)
VALUES
  ('Log a training run', 'Record at least one timed run today.', 15, CURRENT_DATE)
ON CONFLICT (challenge_date) DO NOTHING;
