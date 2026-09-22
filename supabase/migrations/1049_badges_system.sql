-- Ported from BarrelConnect migration 049_badges_system.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('riding', 'social', 'training', 'competition', 'community', 'milestone', 'special')),
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  points_value INTEGER DEFAULT 10,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual', 'challenge')),
  trigger_condition JSONB,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  challenge_id UUID,
  badge_name TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  is_shared BOOLEAN DEFAULT false,
  shared_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT false,
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  total_badges INTEGER DEFAULT 0,
  rank INTEGER,
  period TEXT DEFAULT 'all_time',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_points ON public.leaderboards(total_points DESC);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badge definitions" ON public.badge_definitions FOR SELECT USING (true);
CREATE POLICY "Anyone can view user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Users can earn badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own badges" ON public.user_badges FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view leaderboards" ON public.leaderboards FOR SELECT USING (true);
CREATE POLICY "Users can manage own leaderboard" ON public.leaderboards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.badge_definitions (name, description, icon, category, rarity, points_value, trigger_type, trigger_condition) VALUES
  ('First Run', 'Complete your first timed run', 'stopwatch', 'riding', 'common', 10, 'auto', '{"type": "run_count", "threshold": 1}'),
  ('Speed Demon', 'Record a sub-16 second run', 'flash', 'riding', 'rare', 50, 'auto', '{"type": "best_time", "threshold": 16}'),
  ('Century Club', 'Complete 100 runs', 'ribbon', 'milestone', 'epic', 100, 'auto', '{"type": "run_count", "threshold": 100}'),
  ('Social Butterfly', 'Follow 20 riders', 'people', 'social', 'common', 15, 'auto', '{"type": "following_count", "threshold": 20}'),
  ('Barn Star', 'Create a group chat for your barn', 'home', 'community', 'uncommon', 20, 'auto', '{"type": "group_created", "threshold": 1}'),
  ('Challenge Champion', 'Win 1st place in a community challenge', 'trophy', 'competition', 'rare', 75, 'auto', '{"type": "challenge_wins", "threshold": 1}'),
  ('Iron Horse', 'Log runs 7 days in a row', 'flame', 'training', 'uncommon', 30, 'auto', '{"type": "consecutive_days", "threshold": 7}'),
  ('Podium Regular', '3 top-3 finishes in events', 'podium', 'competition', 'rare', 60, 'auto', '{"type": "podium_finishes", "threshold": 3}'),
  ('Fan Favorite', 'Reach 50 followers', 'heart', 'social', 'uncommon', 25, 'auto', '{"type": "follower_count", "threshold": 50}'),
  ('Horse Whisperer', 'Register 5 horses', 'paw', 'riding', 'uncommon', 20, 'auto', '{"type": "horse_count", "threshold": 5}')
ON CONFLICT (name) DO NOTHING;
