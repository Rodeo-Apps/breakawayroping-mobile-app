-- Ported from BarrelConnect migration 068_ensure_user_reports_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Ensure user_reports exists for in-app reporting (DM / group).
-- Fixes PostgREST: "could not find the table public.user_reports in the schema cache"
-- when migration 050 was never applied on this project.

CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_content_id UUID,
  reported_content_type TEXT CHECK (reported_content_type IN ('user', 'post', 'comment', 'message', 'group', 'listing')),
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'inappropriate_content', 'impersonation', 'scam', 'animal_abuse', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON public.user_reports(reported_user_id);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Replace policies idempotently (050 referenced user_roles.role which does not exist on 043 schema)
DROP POLICY IF EXISTS "Users can view own reports" ON public.user_reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.user_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.user_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.user_reports;

CREATE POLICY "Users can view own reports"
  ON public.user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports"
  ON public.user_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Review moderation via Supabase Dashboard (service role) or add app-specific admin policies later.
