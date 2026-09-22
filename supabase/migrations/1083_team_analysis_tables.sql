-- Ported from BarrelConnect migration 083_team_analysis_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Team AI Video Analysis schema (isolated)
-- Adds coaching teams, rosters, bulk video batches, per-video AI results, and
-- aggregated team reports. Premium + verified-coach gated via RLS.
--
-- Depends on: profiles (id), schools (id) + is_verified_school_staff() from 081.

-- =====================================================================
-- TABLES
-- =====================================================================

-- Coaching teams: school-based (FK schools) OR custom (owner managed).
CREATE TABLE IF NOT EXISTS public.coaching_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  team_type TEXT NOT NULL DEFAULT 'custom' CHECK (team_type IN ('school', 'custom')),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A school team must reference a school; a custom team must not.
  CONSTRAINT coaching_teams_school_link CHECK (
    (team_type = 'school' AND school_id IS NOT NULL)
    OR (team_type = 'custom' AND school_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coaching_teams_owner_id ON public.coaching_teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_coaching_teams_school_id ON public.coaching_teams(school_id);
CREATE INDEX IF NOT EXISTS idx_coaching_teams_type ON public.coaching_teams(team_type);

-- Team roster: riders + assistant coaches.
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.coaching_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('rider', 'assistant_coach')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

-- Bulk upload sessions.
CREATE TABLE IF NOT EXISTS public.team_video_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.coaching_teams(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  total_videos INTEGER NOT NULL DEFAULT 0,
  processed_videos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_video_batches_team_id ON public.team_video_batches(team_id);
CREATE INDEX IF NOT EXISTS idx_team_video_batches_status ON public.team_video_batches(status);
CREATE INDEX IF NOT EXISTS idx_team_video_batches_uploaded_by ON public.team_video_batches(uploaded_by);

-- Individual videos within a batch.
CREATE TABLE IF NOT EXISTS public.team_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.team_video_batches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.coaching_teams(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  horse_name TEXT,
  event_type TEXT,
  drill_name TEXT,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_videos_batch_id ON public.team_videos(batch_id);
CREATE INDEX IF NOT EXISTS idx_team_videos_team_id ON public.team_videos(team_id);
CREATE INDEX IF NOT EXISTS idx_team_videos_rider_id ON public.team_videos(rider_id);
CREATE INDEX IF NOT EXISTS idx_team_videos_status ON public.team_videos(status);

-- Per-video AI analysis results.
CREATE TABLE IF NOT EXISTS public.run_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.team_videos(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mistakes_identified JSONB NOT NULL DEFAULT '[]'::jsonb,
  timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score NUMERIC,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id)
);

CREATE INDEX IF NOT EXISTS idx_run_analysis_results_video_id ON public.run_analysis_results(video_id);

-- Aggregated team-level insights for a batch.
CREATE TABLE IF NOT EXISTS public.team_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.team_video_batches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.coaching_teams(id) ON DELETE CASCADE,
  common_mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rider_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_drills JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id)
);

CREATE INDEX IF NOT EXISTS idx_team_analysis_reports_batch_id ON public.team_analysis_reports(batch_id);
CREATE INDEX IF NOT EXISTS idx_team_analysis_reports_team_id ON public.team_analysis_reports(team_id);

-- =====================================================================
-- UPDATED_AT TRIGGERS (reuses public.set_updated_at_timestamp from 081)
-- =====================================================================

DROP TRIGGER IF EXISTS trg_coaching_teams_set_updated_at ON public.coaching_teams;
CREATE TRIGGER trg_coaching_teams_set_updated_at
BEFORE UPDATE ON public.coaching_teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_team_video_batches_set_updated_at ON public.team_video_batches;
CREATE TRIGGER trg_team_video_batches_set_updated_at
BEFORE UPDATE ON public.team_video_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_team_videos_set_updated_at ON public.team_videos;
CREATE TRIGGER trg_team_videos_set_updated_at
BEFORE UPDATE ON public.team_videos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =====================================================================
-- HELPER FUNCTIONS (premium + coach gating)
-- =====================================================================

-- Premium gate. profiles.is_premium drives access to the feature.
CREATE OR REPLACE FUNCTION public.is_premium_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_premium FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

-- True when the current user owns the team, or (for school teams) is verified
-- school staff with a coaching role for the linked school.
CREATE OR REPLACE FUNCTION public.is_team_coach(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coaching_teams ct
    WHERE ct.id = target_team_id
      AND (
        ct.owner_id = auth.uid()
        OR (
          ct.team_type = 'school'
          AND ct.school_id IS NOT NULL
          AND public.is_verified_school_staff(
            ct.school_id,
            ARRAY['coach', 'assistant_coach', 'admin']
          )
        )
      )
  );
$$;

-- True when the user is a coach OR an assistant_coach roster member of the team.
CREATE OR REPLACE FUNCTION public.is_team_staff(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_team_coach(target_team_id)
    OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = target_team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'assistant_coach'
    );
$$;

-- True when the user is any member (rider/assistant) or a coach of the team.
CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_team_coach(target_team_id)
    OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = target_team_id
        AND tm.user_id = auth.uid()
    );
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.coaching_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_video_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_analysis_reports ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- coaching_teams
-- ---------------------------------------------------------------------
-- Read: team members, coaches/owners.
DROP POLICY IF EXISTS "Team members can view teams" ON public.coaching_teams;
CREATE POLICY "Team members can view teams"
ON public.coaching_teams
FOR SELECT
TO authenticated
USING (public.is_team_member(id));

-- Create: premium users only. School teams require verified school staff;
-- custom teams require the creator to be the owner.
DROP POLICY IF EXISTS "Premium coaches can create teams" ON public.coaching_teams;
CREATE POLICY "Premium coaches can create teams"
ON public.coaching_teams
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND public.is_premium_user()
  AND (
    team_type = 'custom'
    OR (
      team_type = 'school'
      AND school_id IS NOT NULL
      AND public.is_verified_school_staff(
        school_id,
        ARRAY['coach', 'assistant_coach', 'admin']
      )
    )
  )
);

DROP POLICY IF EXISTS "Team coaches can update teams" ON public.coaching_teams;
CREATE POLICY "Team coaches can update teams"
ON public.coaching_teams
FOR UPDATE
TO authenticated
USING (public.is_team_coach(id))
WITH CHECK (public.is_team_coach(id));

DROP POLICY IF EXISTS "Team owners can delete teams" ON public.coaching_teams;
CREATE POLICY "Team owners can delete teams"
ON public.coaching_teams
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can view roster" ON public.team_members;
CREATE POLICY "Team members can view roster"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Team coaches can manage roster" ON public.team_members;
CREATE POLICY "Team coaches can manage roster"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_team_coach(team_id))
WITH CHECK (public.is_team_coach(team_id));

-- ---------------------------------------------------------------------
-- team_video_batches
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can view batches" ON public.team_video_batches;
CREATE POLICY "Team members can view batches"
ON public.team_video_batches
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS "Team staff can create batches" ON public.team_video_batches;
CREATE POLICY "Team staff can create batches"
ON public.team_video_batches
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.is_premium_user()
  AND public.is_team_staff(team_id)
);

DROP POLICY IF EXISTS "Team staff can update batches" ON public.team_video_batches;
CREATE POLICY "Team staff can update batches"
ON public.team_video_batches
FOR UPDATE
TO authenticated
USING (public.is_team_staff(team_id))
WITH CHECK (public.is_team_staff(team_id));

DROP POLICY IF EXISTS "Team coaches can delete batches" ON public.team_video_batches;
CREATE POLICY "Team coaches can delete batches"
ON public.team_video_batches
FOR DELETE
TO authenticated
USING (public.is_team_coach(team_id));

-- ---------------------------------------------------------------------
-- team_videos
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can view videos" ON public.team_videos;
CREATE POLICY "Team members can view videos"
ON public.team_videos
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS "Team staff can add videos" ON public.team_videos;
CREATE POLICY "Team staff can add videos"
ON public.team_videos
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_premium_user()
  AND public.is_team_staff(team_id)
);

DROP POLICY IF EXISTS "Team staff can update videos" ON public.team_videos;
CREATE POLICY "Team staff can update videos"
ON public.team_videos
FOR UPDATE
TO authenticated
USING (public.is_team_staff(team_id))
WITH CHECK (public.is_team_staff(team_id));

DROP POLICY IF EXISTS "Team coaches can delete videos" ON public.team_videos;
CREATE POLICY "Team coaches can delete videos"
ON public.team_videos
FOR DELETE
TO authenticated
USING (public.is_team_coach(team_id));

-- ---------------------------------------------------------------------
-- run_analysis_results (read for team members; writes via service role)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can view analysis results" ON public.run_analysis_results;
CREATE POLICY "Team members can view analysis results"
ON public.run_analysis_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_videos tv
    WHERE tv.id = run_analysis_results.video_id
      AND public.is_team_member(tv.team_id)
  )
);

-- Coaches may manually correct/insert analysis (edge function uses service role).
DROP POLICY IF EXISTS "Team coaches can manage analysis results" ON public.run_analysis_results;
CREATE POLICY "Team coaches can manage analysis results"
ON public.run_analysis_results
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_videos tv
    WHERE tv.id = run_analysis_results.video_id
      AND public.is_team_coach(tv.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_videos tv
    WHERE tv.id = run_analysis_results.video_id
      AND public.is_team_coach(tv.team_id)
  )
);

-- ---------------------------------------------------------------------
-- team_analysis_reports
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can view reports" ON public.team_analysis_reports;
CREATE POLICY "Team members can view reports"
ON public.team_analysis_reports
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS "Team coaches can manage reports" ON public.team_analysis_reports;
CREATE POLICY "Team coaches can manage reports"
ON public.team_analysis_reports
FOR ALL
TO authenticated
USING (public.is_team_coach(team_id))
WITH CHECK (public.is_team_coach(team_id));

-- =====================================================================
-- STORAGE BUCKET for team video uploads
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-videos', 'team-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated premium users may upload to team-videos; public read.
DROP POLICY IF EXISTS "Team videos are publicly readable" ON storage.objects;
CREATE POLICY "Team videos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'team-videos');

DROP POLICY IF EXISTS "Premium users can upload team videos" ON storage.objects;
CREATE POLICY "Premium users can upload team videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-videos'
  AND public.is_premium_user()
);

DROP POLICY IF EXISTS "Uploaders can update own team videos" ON storage.objects;
CREATE POLICY "Uploaders can update own team videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'team-videos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'team-videos' AND owner = auth.uid());

DROP POLICY IF EXISTS "Uploaders can delete own team videos" ON storage.objects;
CREATE POLICY "Uploaders can delete own team videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'team-videos' AND owner = auth.uid());
