-- Ported from BarrelConnect migration 090_weekly_leaderboards.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 090_weekly_leaderboards.sql
-- Quick Win #7: Weekly leaderboards
--
-- Append-only points ledger. Users earn points for activity (posting, logging
-- runs). Each award is stamped with the Monday of its week so the app can rank
-- riders for the current week. Distinct from the all-time `leaderboards` table
-- (049_badges_system.sql).
-- ============================================================================

-- Monday (UTC) of the week containing the given date.
CREATE OR REPLACE FUNCTION public.week_start_of(p_ts TIMESTAMPTZ DEFAULT now())
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (date_trunc('week', p_ts))::date;
$$;

CREATE TABLE IF NOT EXISTS public.user_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points          INTEGER NOT NULL,
  reason          TEXT,
  week_start_date DATE NOT NULL DEFAULT public.week_start_of(now()),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast "top riders this week" aggregation.
CREATE INDEX IF NOT EXISTS idx_user_points_week
  ON public.user_points(week_start_date, user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user
  ON public.user_points(user_id);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read points (needed to build the leaderboard).
DROP POLICY IF EXISTS "Points are readable" ON public.user_points;
CREATE POLICY "Points are readable"
  ON public.user_points FOR SELECT
  TO authenticated
  USING (true);
-- Inserts happen only through the SECURITY DEFINER award_points() helper
-- (called by triggers), so no INSERT policy is granted to clients.

-- ----------------------------------------------------------------------------
-- award_points — central helper used by triggers.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_points  INTEGER,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_points IS NULL OR p_points = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_points (user_id, points, reason, week_start_date)
  VALUES (p_user_id, p_points, p_reason, public.week_start_of(now()));
END;
$$;

-- ----------------------------------------------------------------------------
-- Triggers: award points for engagement activity.
-- ----------------------------------------------------------------------------

-- +5 points per post created.
CREATE OR REPLACE FUNCTION public.award_points_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 5, 'post_created');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_points_on_post ON public.posts;
CREATE TRIGGER trg_award_points_on_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_post();

-- +10 points per training run logged.
CREATE OR REPLACE FUNCTION public.award_points_on_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 10, 'run_logged');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_points_on_run ON public.runs;
CREATE TRIGGER trg_award_points_on_run
  AFTER INSERT ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_run();

-- ----------------------------------------------------------------------------
-- RPC: get_weekly_leaderboard — top riders for a given week (defaults to the
-- current week). Returns aggregated points joined to profile display info.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  p_week_start DATE DEFAULT public.week_start_of(now()),
  p_limit      INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id      UUID,
  name         TEXT,
  avatar_url   TEXT,
  total_points BIGINT,
  rank         BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.user_id,
    p.name,
    p.avatar_url,
    SUM(up.points)::BIGINT AS total_points,
    RANK() OVER (ORDER BY SUM(up.points) DESC) AS rank
  FROM public.user_points up
  LEFT JOIN public.profiles p ON p.id = up.user_id
  WHERE up.week_start_date = p_week_start
  GROUP BY up.user_id, p.name, p.avatar_url
  ORDER BY total_points DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(DATE, INTEGER) TO authenticated;
