-- Ported from BarrelConnect migration 071_comment_dislikes.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Comment dislikes (mirrors comment_likes); users have at most one reaction per comment (enforced in app)

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS dislike_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.comment_dislikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_dislikes_comment_id ON public.comment_dislikes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_dislikes_user_id ON public.comment_dislikes(user_id);

ALTER TABLE public.comment_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comment dislikes" ON public.comment_dislikes;
CREATE POLICY "Anyone can view comment dislikes"
  ON public.comment_dislikes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own comment dislikes" ON public.comment_dislikes;
CREATE POLICY "Users can insert own comment dislikes"
  ON public.comment_dislikes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comment dislikes" ON public.comment_dislikes;
CREATE POLICY "Users can delete own comment dislikes"
  ON public.comment_dislikes FOR DELETE USING (auth.uid() = user_id);
