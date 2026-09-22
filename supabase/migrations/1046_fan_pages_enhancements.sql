-- Ported from BarrelConnect migration 046_fan_pages_enhancements.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fan_page_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fan_page_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS fan_page_tagline TEXT,
  ADD COLUMN IF NOT EXISTS fan_page_sponsors TEXT[],
  ADD COLUMN IF NOT EXISTS fan_page_social_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fan_page_featured_horse_id UUID,
  ADD COLUMN IF NOT EXISTS fan_page_theme TEXT DEFAULT 'default';

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.user_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

CREATE TABLE IF NOT EXISTS public.fan_page_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[],
  post_type TEXT DEFAULT 'update' CHECK (post_type IN ('update', 'achievement', 'result', 'sponsor', 'media')),
  is_pinned BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fan_page_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public fan pages posts are viewable" ON public.fan_page_posts
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = fan_page_posts.user_id AND fan_page_enabled = true));
CREATE POLICY "Owner can manage fan page posts" ON public.fan_page_posts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
