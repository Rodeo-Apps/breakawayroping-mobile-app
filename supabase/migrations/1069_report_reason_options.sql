-- Ported from BarrelConnect migration 069_report_reason_options.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Configurable report reasons (labels + ordering) managed in the database.
-- user_reports.reason stores reason_key and must reference an active option row.

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

-- Staff can manage options (service role bypasses RLS). For in-dashboard edits via SQL:
-- INSERT/UPDATE as postgres or add a policy tied to your admin model later.

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

-- Replace CHECK on user_reports.reason with FK so new keys can be added via report_reason_options only.
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_reason_check;

ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_reason_fkey;

ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_reason_fkey
  FOREIGN KEY (reason) REFERENCES public.report_reason_options(reason_key);
