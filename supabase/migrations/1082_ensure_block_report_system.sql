-- Ported from BarrelConnect migration 082_ensure_block_report_system.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Block + report system (idempotent).
-- Run this on Supabase if you see:
--   PGRST205: Could not find the table 'public.user_blocks' in the schema cache
--
-- Requires: public.profiles (migration 036+)

-- =============================================================================
-- 1) user_blocks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks" ON public.user_blocks;
CREATE POLICY "Users can view own blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block" ON public.user_blocks;
CREATE POLICY "Users can block"
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can unblock" ON public.user_blocks;
CREATE POLICY "Users can unblock"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

-- =============================================================================
-- 2) report_reason_options (must exist before user_reports.reason FK)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.report_reason_options (
  reason_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_reason_options_active_order
  ON public.report_reason_options (is_active, display_order);

ALTER TABLE public.report_reason_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active report reasons" ON public.report_reason_options;
CREATE POLICY "Authenticated can read active report reasons"
  ON public.report_reason_options
  FOR SELECT
  TO authenticated
  USING (is_active = true);

INSERT INTO public.report_reason_options (reason_key, label, display_order, is_active)
VALUES
  ('spam', 'Spam', 10, true),
  ('harassment', 'Harassment', 20, true),
  ('hate_speech', 'Hate speech', 30, true),
  ('inappropriate_content', 'Inappropriate content', 40, true),
  ('impersonation', 'Impersonation', 50, true),
  ('scam', 'Scam', 60, true),
  ('animal_abuse', 'Animal abuse', 70, true),
  ('other', 'Other', 100, true)
ON CONFLICT (reason_key) DO UPDATE
SET
  label = EXCLUDED.label,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =============================================================================
-- 3) user_reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_content_id UUID,
  reported_content_type TEXT CHECK (
    reported_content_type IN (
      'user', 'post', 'comment', 'message', 'group', 'listing'
    )
  ),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewing', 'resolved', 'dismissed')
  ),
  admin_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON public.user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON public.user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_content ON public.user_reports(reported_content_type, reported_content_id);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Drop legacy admin policies (050 referenced user_roles.role column that does not exist)
DROP POLICY IF EXISTS "Admins can view all reports" ON public.user_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.user_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.user_reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.user_reports;

CREATE POLICY "Users can view own reports"
  ON public.user_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports"
  ON public.user_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Link reason to report_reason_options (run after both tables exist)
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_reason_check;
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_reason_fkey;

ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_reason_fkey
  FOREIGN KEY (reason) REFERENCES public.report_reason_options(reason_key);

-- =============================================================================
-- 4) Notify PostgREST to reload schema (optional; Dashboard refresh also works)
-- =============================================================================
NOTIFY pgrst, 'reload schema';
