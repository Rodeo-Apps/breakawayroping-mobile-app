-- Ported from BarrelConnect migration 085_coach_self_service.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 085: Coach self-service — school page creation, coach verification, and
--      student affiliation approval (email/code workflow).
-- ----------------------------------------------------------------------------
-- Lets ANY user create/claim a school page and become a VERIFIED coach by
-- confirming a 6-digit code sent to their school email. Students request to
-- join a school/team; the verified coach is notified (in-app + email) and
-- approves/denies. Approved students appear on the roster.
--
-- Depends on: 081 (schools, school_staff, athlete_school_affiliations,
--             is_verified_school_staff), 083 (coaching_teams, team_members),
--             045 (notifications).
-- ============================================================================

-- pgcrypto provides digest() used for hashing verification codes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Allow authenticated users to CREATE school pages (claim/insert).
--    081 only allowed verified staff to UPDATE; there was no INSERT policy.
--    The creator is expected to immediately request coach verification.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create schools" ON public.schools;
CREATE POLICY "Authenticated users can create schools"
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Let users add themselves as (unverified) staff so a self-created page has an
-- owner. Verification flips is_verified to true. They can only insert a row for
-- themselves and cannot self-verify (is_verified must be false on insert).
DROP POLICY IF EXISTS "Users can claim staff role unverified" ON public.school_staff;
CREATE POLICY "Users can claim staff role unverified"
ON public.school_staff
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_verified = false);

DROP POLICY IF EXISTS "Users can view own staff rows" ON public.school_staff;
CREATE POLICY "Users can view own staff rows"
ON public.school_staff
FOR SELECT
USING (true);  -- staff list is public (already true via 081); kept explicit

-- ----------------------------------------------------------------------------
-- 2. Coach verification requests (email-code workflow).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL DEFAULT 'coach'
    CHECK (requested_role IN ('coach', 'assistant_coach', 'admin', 'staff')),
  method TEXT NOT NULL DEFAULT 'email_code'
    CHECK (method IN ('email_code', 'manual')),
  email TEXT,
  code_hash TEXT,                 -- sha256 of the 6-digit code (never store raw)
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cvr_user ON public.coach_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cvr_school ON public.coach_verification_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_cvr_status ON public.coach_verification_requests(status);

DROP TRIGGER IF EXISTS trg_cvr_set_updated_at ON public.coach_verification_requests;
CREATE TRIGGER trg_cvr_set_updated_at
BEFORE UPDATE ON public.coach_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.coach_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own verification requests.
DROP POLICY IF EXISTS "Users manage own coach verification" ON public.coach_verification_requests;
CREATE POLICY "Users manage own coach verification"
ON public.coach_verification_requests
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Team join requests (student -> team, coach approves).
--    School-level claims keep using athlete_school_affiliations (081).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.coaching_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tjr_team ON public.team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_tjr_user ON public.team_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tjr_status ON public.team_join_requests(status);

DROP TRIGGER IF EXISTS trg_tjr_set_updated_at ON public.team_join_requests;
CREATE TRIGGER trg_tjr_set_updated_at
BEFORE UPDATE ON public.team_join_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a coach/owner of this team?
CREATE OR REPLACE FUNCTION public.is_coaching_team_manager(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaching_teams ct
    WHERE ct.id = target_team_id
      AND (
        ct.owner_id = auth.uid()
        OR (ct.school_id IS NOT NULL AND public.is_verified_school_staff(ct.school_id))
      )
  );
$$;

-- Student sees own requests; team managers see requests for their team.
DROP POLICY IF EXISTS "View team join requests" ON public.team_join_requests;
CREATE POLICY "View team join requests"
ON public.team_join_requests
FOR SELECT
USING (user_id = auth.uid() OR public.is_coaching_team_manager(team_id));

-- Student creates own pending request.
DROP POLICY IF EXISTS "Student creates own join request" ON public.team_join_requests;
CREATE POLICY "Student creates own join request"
ON public.team_join_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending' AND decided_by IS NULL);

-- Student can cancel own pending request; managers can decide.
DROP POLICY IF EXISTS "Update team join request" ON public.team_join_requests;
CREATE POLICY "Update team join request"
ON public.team_join_requests
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR public.is_coaching_team_manager(team_id)
)
WITH CHECK (
  (user_id = auth.uid() AND status IN ('pending', 'cancelled'))
  OR public.is_coaching_team_manager(team_id)
);

-- Allow verified team managers to insert approved members (needed by approve RPC
-- runs as definer, but also lets a coach add directly).
DROP POLICY IF EXISTS "Team managers add members" ON public.team_members;
CREATE POLICY "Team managers add members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_coaching_team_manager(team_id) OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Notification helper (SECURITY DEFINER so RPCs can notify other users).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_user(
  target_user_id UUID,
  n_type TEXT,
  n_title TEXT,
  n_body TEXT,
  n_data JSONB DEFAULT '{}'::jsonb,
  n_related_user UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data, related_user_id)
  VALUES (target_user_id, n_type, n_title, n_body, COALESCE(n_data, '{}'::jsonb), n_related_user);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: request_coach_verification
--    Creates the staff (unverified) row + a verification request with a hashed
--    code. The raw code + email payload are returned for the edge function to
--    email. School-domain match is enforced when the school has a known domain.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_coach_verification(
  p_school_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'coach'
)
RETURNS TABLE (request_id UUID, code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_expires TIMESTAMPTZ := now() + interval '15 minutes';
  v_req_id UUID;
  v_domain TEXT;
  v_school_domain TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'School not found';
  END IF;
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;

  -- Optional domain gate: schools.metadata->>'email_domain' (e.g. "wtamu.edu")
  v_school_domain := (SELECT lower(metadata->>'email_domain') FROM public.schools WHERE id = p_school_id);
  v_domain := lower(split_part(p_email, '@', 2));
  IF v_school_domain IS NOT NULL AND v_school_domain <> '' AND v_domain <> v_school_domain THEN
    RAISE EXCEPTION 'Email must be on the % domain to verify this school', v_school_domain;
  END IF;

  -- Ensure an (unverified) staff row exists for this user/school/role.
  INSERT INTO public.school_staff (school_id, user_id, role, is_verified)
  VALUES (p_school_id, v_uid, p_role, false)
  ON CONFLICT (school_id, user_id, role) DO NOTHING;

  -- 6-digit code, stored only as a sha256 hash.
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO public.coach_verification_requests
    (user_id, school_id, requested_role, method, email, code_hash, status, expires_at)
  VALUES
    (v_uid, p_school_id, p_role, 'email_code', lower(p_email),
     encode(digest(v_code, 'sha256'), 'hex'), 'pending', v_expires)
  RETURNING id INTO v_req_id;

  request_id := v_req_id;
  code := v_code;       -- returned ONLY to the caller (edge function emails it)
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: confirm_coach_verification — checks code, verifies staff row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_coach_verification(
  p_request_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  r public.coach_verification_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.coach_verification_requests
  WHERE id = p_request_id AND user_id = v_uid;

  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found'; END IF;
  IF r.status = 'verified' THEN RETURN true; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is %', r.status; END IF;
  IF r.expires_at < now() THEN
    UPDATE public.coach_verification_requests SET status = 'expired' WHERE id = r.id;
    RAISE EXCEPTION 'Code expired — request a new one';
  END IF;
  IF r.attempts >= 5 THEN
    UPDATE public.coach_verification_requests SET status = 'rejected' WHERE id = r.id;
    RAISE EXCEPTION 'Too many attempts';
  END IF;

  IF r.code_hash <> encode(digest(coalesce(p_code,''), 'sha256'), 'hex') THEN
    UPDATE public.coach_verification_requests SET attempts = attempts + 1 WHERE id = r.id;
    RETURN false;
  END IF;

  -- Success: verify the staff row.
  UPDATE public.coach_verification_requests
  SET status = 'verified', verified_at = now() WHERE id = r.id;

  INSERT INTO public.school_staff (school_id, user_id, role, is_verified)
  VALUES (r.school_id, r.user_id, r.requested_role, true)
  ON CONFLICT (school_id, user_id, role)
  DO UPDATE SET is_verified = true, updated_at = now();

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC: request_team_join — student asks to join a team; notify managers.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_team_join(
  p_team_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req_id UUID;
  v_team RECORD;
  v_name TEXT;
  mgr RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, name, owner_id, school_id INTO v_team FROM public.coaching_teams WHERE id = p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'You are already on this team';
  END IF;

  INSERT INTO public.team_join_requests (team_id, user_id, message, status)
  VALUES (p_team_id, v_uid, p_message, 'pending')
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET status = 'pending', message = EXCLUDED.message, decided_by = NULL,
        decided_at = NULL, updated_at = now()
  RETURNING id INTO v_req_id;

  SELECT coalesce(full_name, name, 'A rider') INTO v_name FROM public.profiles WHERE id = v_uid;

  -- Notify the owner + all verified coaches of the team's school.
  PERFORM public.notify_user(
    v_team.owner_id, 'team_join_request',
    'New team join request',
    v_name || ' requested to join ' || v_team.name,
    jsonb_build_object('team_id', p_team_id, 'request_id', v_req_id),
    v_uid
  );

  IF v_team.school_id IS NOT NULL THEN
    FOR mgr IN
      SELECT DISTINCT user_id FROM public.school_staff
      WHERE school_id = v_team.school_id AND is_verified = true AND user_id <> v_team.owner_id
    LOOP
      PERFORM public.notify_user(
        mgr.user_id, 'team_join_request',
        'New team join request',
        v_name || ' requested to join ' || v_team.name,
        jsonb_build_object('team_id', p_team_id, 'request_id', v_req_id),
        v_uid
      );
    END LOOP;
  END IF;

  RETURN v_req_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: decide_team_join — coach approves/denies; adds member + notifies.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_team_join(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  r public.team_join_requests%ROWTYPE;
  v_team_name TEXT;
BEGIN
  SELECT * INTO r FROM public.team_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.is_coaching_team_manager(r.team_id) THEN
    RAISE EXCEPTION 'Only the coach can decide this request';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', r.status; END IF;

  UPDATE public.team_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = v_uid, decided_at = now()
  WHERE id = r.id;

  SELECT name INTO v_team_name FROM public.coaching_teams WHERE id = r.team_id;

  IF p_approve THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (r.team_id, r.user_id, 'rider')
    ON CONFLICT (team_id, user_id) DO NOTHING;

    PERFORM public.notify_user(
      r.user_id, 'team_join_approved',
      'You''re on the team!',
      'You were added to ' || coalesce(v_team_name, 'the team'),
      jsonb_build_object('team_id', r.team_id), v_uid
    );
  ELSE
    PERFORM public.notify_user(
      r.user_id, 'team_join_rejected',
      'Team request update',
      'Your request to join ' || coalesce(v_team_name, 'the team') || ' was not approved',
      jsonb_build_object('team_id', r.team_id), v_uid
    );
  END IF;

  RETURN true;
END;
$$;
