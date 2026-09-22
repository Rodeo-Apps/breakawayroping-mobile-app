-- Ported from BarrelConnect migration 048_challenges_enhancements.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

CREATE TABLE IF NOT EXISTS public.community_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('fastest_time', 'most_runs', 'improvement', 'consistency', 'distance', 'custom')),
  difficulty_level TEXT DEFAULT 'intermediate' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'pro')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  entry_fee_cents INTEGER DEFAULT 0,
  prize_pool_cents INTEGER DEFAULT 0,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  rules JSONB DEFAULT '{}',
  scoring_method TEXT DEFAULT 'best_single' CHECK (scoring_method IN ('best_single', 'average', 'cumulative', 'improvement')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_status TEXT DEFAULT 'confirmed' CHECK (registration_status IN ('pending', 'confirmed', 'disqualified')),
  entry_fee_paid_cents INTEGER DEFAULT 0,
  best_performance NUMERIC,
  total_runs INTEGER DEFAULT 0,
  current_rank INTEGER,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  performance_value NUMERIC NOT NULL,
  total_entries INTEGER DEFAULT 0,
  prize_eligible BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID,
  performance_value NUMERIC NOT NULL,
  video_url TEXT,
  verified BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON public.challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_leaderboard_rank ON public.challenge_leaderboard(challenge_id, rank);

ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view challenges" ON public.community_challenges FOR SELECT USING (true);
CREATE POLICY "Admins can create challenges" ON public.community_challenges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'producer')));
CREATE POLICY "Anyone can view participants" ON public.challenge_participants FOR SELECT USING (true);
CREATE POLICY "Users can join challenges" ON public.challenge_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view leaderboard" ON public.challenge_leaderboard FOR SELECT USING (true);
CREATE POLICY "Participants can view submissions" ON public.challenge_submissions FOR SELECT USING (true);
CREATE POLICY "Users can submit" ON public.challenge_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_challenge_leaderboard(p_challenge_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.challenge_leaderboard WHERE challenge_id = p_challenge_id;
  INSERT INTO public.challenge_leaderboard (challenge_id, user_id, rank, performance_value, total_entries, prize_eligible, updated_at)
  SELECT p_challenge_id, user_id,
    ROW_NUMBER() OVER (ORDER BY MIN(performance_value) ASC),
    MIN(performance_value), COUNT(*),
    ROW_NUMBER() OVER (ORDER BY MIN(performance_value) ASC) <= 3, now()
  FROM public.challenge_submissions
  WHERE challenge_id = p_challenge_id AND verified = true
  GROUP BY user_id;
END;
$$;
