-- Ported from BarrelConnect migration 043_user_roles.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Role options that users can select during signup.
CREATE TABLE IF NOT EXISTS public.user_role_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL UNIQUE,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mapping table for users and selected roles (supports multi-select).
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.user_role_options(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

INSERT INTO public.user_role_options (key, label, display_order)
VALUES
  ('competitor_rider', 'Competitor / Rider', 1),
  ('horse_owner', 'Horse Owner', 2),
  ('trainer_coach', 'Trainer / Coach', 3),
  ('event_organizer', 'Event Organizer', 4),
  ('fan_spectator', 'Fan / Spectator', 5)
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  display_order = EXCLUDED.display_order,
  is_active = true;

ALTER TABLE public.user_role_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view role options" ON public.user_role_options;
CREATE POLICY "Anyone can view role options"
  ON public.user_role_options FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;
CREATE POLICY "Users can delete own roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
