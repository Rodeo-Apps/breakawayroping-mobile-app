-- Ported from BarrelConnect migration 044_onboarding_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Onboarding content and per-user onboarding progress.
-- Referenced by BeginnerOnboardingScreen.

CREATE TABLE IF NOT EXISTS public.onboarding_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'basics',
  slide_order INTEGER NOT NULL UNIQUE,
  icon_name TEXT NOT NULL DEFAULT 'school',
  target_audience TEXT NOT NULL DEFAULT 'beginner',
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES public.onboarding_content(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slide_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_content_active_order
  ON public.onboarding_content(is_active, slide_order);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_id
  ON public.user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_slide_id
  ON public.user_onboarding_progress(slide_id);

INSERT INTO public.onboarding_content
  (title, subtitle, content, content_type, slide_order, icon_name, target_audience, is_required, is_active)
VALUES
  (
    'Welcome to Barrel Connect',
    'Your barrel racing home base',
    'Track runs, connect with your community, and grow your skills all in one place.',
    'basics',
    1,
    'flag',
    'beginner',
    true,
    true
  ),
  (
    'Safety First',
    'Ride smart and prepared',
    'Wear appropriate gear, inspect tack before each run, and prioritize horse and rider safety at every event.',
    'safety',
    2,
    'shield-checkmark',
    'beginner',
    true,
    true
  ),
  (
    'Train With Intention',
    'Build consistency',
    'Use run tracking and video analysis to review times, identify patterns, and steadily improve your turns.',
    'tutorial',
    3,
    'timer',
    'beginner',
    true,
    true
  ),
  (
    'Find Mentors and Community',
    'You are not riding alone',
    'Engage with riders, ask questions, and learn from experienced competitors to level up faster.',
    'mentor_matching',
    4,
    'people',
    'beginner',
    false,
    true
  )
ON CONFLICT (slide_order) DO UPDATE
SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  content = EXCLUDED.content,
  content_type = EXCLUDED.content_type,
  icon_name = EXCLUDED.icon_name,
  target_audience = EXCLUDED.target_audience,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE public.onboarding_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active onboarding content" ON public.onboarding_content;
CREATE POLICY "Anyone can view active onboarding content"
  ON public.onboarding_content FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can view own onboarding progress"
  ON public.user_onboarding_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can insert own onboarding progress"
  ON public.user_onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can update own onboarding progress"
  ON public.user_onboarding_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
