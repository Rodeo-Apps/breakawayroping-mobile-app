-- Ported from BarrelConnect migration 085_user_training_streaks.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 085_user_training_streaks.sql
-- Quick Win #2: Training Streak counter
--
-- Tracks a consecutive-day training streak per user. A "training day" is any
-- day the user logs a run (public.runs). The streak updates automatically via
-- a trigger whenever a run is inserted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak     INTEGER NOT NULL DEFAULT 0,
  longest_streak     INTEGER NOT NULL DEFAULT 0,
  last_training_date DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view streaks" ON public.user_streaks;
CREATE POLICY "Anyone can view streaks"
  ON public.user_streaks FOR SELECT
  USING (true);

-- Streaks are maintained by the SECURITY DEFINER trigger below; users may also
-- read/refresh their own row.
DROP POLICY IF EXISTS "Users can manage own streak" ON public.user_streaks;
CREATE POLICY "Users can manage own streak"
  ON public.user_streaks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Trigger: recompute streak when a run is logged.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_training_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_date DATE := COALESCE(NEW.run_date, (NEW.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
  v_last     DATE;
  v_current  INTEGER;
  v_longest  INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT last_training_date, current_streak, longest_streak
    INTO v_last, v_current, v_longest
  FROM public.user_streaks
  WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    -- First ever training day for this user.
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_training_date, updated_at)
    VALUES (NEW.user_id, 1, 1, v_run_date, now());
    RETURN NEW;
  END IF;

  IF v_last IS NULL THEN
    v_current := 1;
  ELSIF v_run_date = v_last THEN
    -- Already trained on this date; streak unchanged.
    v_current := GREATEST(v_current, 1);
  ELSIF v_run_date = v_last + 1 THEN
    -- Consecutive day -> extend streak.
    v_current := v_current + 1;
  ELSIF v_run_date > v_last THEN
    -- Gap of 2+ days -> streak restarts.
    v_current := 1;
  ELSE
    -- Back-dated run (older than last_training_date) -> do not alter streak.
    RETURN NEW;
  END IF;

  v_longest := GREATEST(COALESCE(v_longest, 0), v_current);

  UPDATE public.user_streaks
  SET current_streak     = v_current,
      longest_streak     = v_longest,
      last_training_date = GREATEST(v_last, v_run_date),
      updated_at         = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_training_streak ON public.runs;
CREATE TRIGGER trg_update_training_streak
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.update_training_streak();

-- ----------------------------------------------------------------------------
-- Backfill existing users' streaks from their run history (idempotent).
-- Uses the classic "gaps and islands" technique: consecutive training days
-- share the same (day - row_number) grouping key. We take the island that
-- ends on each user's most recent training day as their current streak, and
-- the largest island as their longest streak.
-- ----------------------------------------------------------------------------
WITH distinct_days AS (
  SELECT DISTINCT user_id, run_date AS day
  FROM public.runs
  WHERE user_id IS NOT NULL AND run_date IS NOT NULL
),
islands AS (
  SELECT
    user_id,
    day,
    day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS grp
  FROM distinct_days
),
island_lengths AS (
  SELECT
    user_id,
    grp,
    COUNT(*)::int AS streak_len,
    MAX(day) AS island_end
  FROM islands
  GROUP BY user_id, grp
),
agg AS (
  SELECT
    user_id,
    MAX(island_end) AS last_training_date,
    MAX(streak_len) AS longest_streak,
    MAX(streak_len) FILTER (WHERE island_end = (SELECT MAX(island_end) FROM island_lengths il2 WHERE il2.user_id = il.user_id)) AS current_streak
  FROM island_lengths il
  GROUP BY user_id
)
INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_training_date, updated_at)
SELECT user_id, COALESCE(current_streak, 0), COALESCE(longest_streak, 0), last_training_date, now()
FROM agg
ON CONFLICT (user_id) DO NOTHING;
