-- Ported from BarrelConnect migration 084_wtamu_first_school_and_team.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 084: West Texas A&M University — first college school + WTAMU Rodeo Team
-- ----------------------------------------------------------------------------
-- Seeds WTAMU as the flagship college school page, and provides an idempotent
-- helper to wire head coach Cody Bonds + the "WTAMU Rodeo Team" coaching team
-- once his profile (auth account) exists.
--
-- Depends on: 081 (schools, school_staff, is_verified_school_staff),
--             083 (coaching_teams, team_members).
--
-- Coach to link: Cody (Joe) Bonds — Head Coach since 2023, also Instructor of
-- Animal Science. NIRA Southwest / Caprock Region.
-- Source: https://www.wtamu.edu/  (rodeo team page linked in metadata)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Insert / update the WTAMU school record (no user dependency — safe now).
-- ----------------------------------------------------------------------------
INSERT INTO public.schools (
  name, type, colors, mascot, region, association, state, city, country, metadata, source
)
VALUES (
  'West Texas A&M University',
  'college',
  'Maroon and White',
  'Buffaloes',
  'Caprock Region (NIRA Southwest)',
  'NIRA',
  'TX',
  'Canyon',
  'US',
  jsonb_build_object(
    'website', 'https://www.wtamu.edu/',
    'rodeo_page', 'https://www.wtamu.edu/academics/college-agriculture-natural-sciences/department-agricultural-sciences/rodeo-team/index.html',
    'primary_hex', '#640817',
    'secondary_hex', '#FFFFFF',
    'conference', 'NCAA Division II Lone Star Conference',
    'roster_size', 45,
    'points_team', '10 athletes (6 men, 4 women)',
    'rodeos_per_year', 10,
    'national_championships', jsonb_build_array('2006 Men''s Team National Championship'),
    'live_mascot', 'Thunder',
    'head_coach', 'Cody Bonds',
    'is_flagship', true
  ),
  'wtamu_official'
)
ON CONFLICT (name, type, state) DO UPDATE SET
  colors      = EXCLUDED.colors,
  mascot      = EXCLUDED.mascot,
  region      = EXCLUDED.region,
  association = EXCLUDED.association,
  city        = EXCLUDED.city,
  metadata    = EXCLUDED.metadata,
  source      = EXCLUDED.source,
  updated_at  = now();

-- ----------------------------------------------------------------------------
-- 2. Helper: wire Cody Bonds (or any coach profile) as the verified head coach
--    of WTAMU and create the "WTAMU Rodeo Team" coaching team owned by him.
--    Idempotent — safe to run multiple times.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.setup_wtamu_rodeo_team(coach_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_team_id   UUID;
BEGIN
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE name = 'West Texas A&M University' AND type = 'college' AND state = 'TX'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'WTAMU school record not found — run the seed in 084 first.';
  END IF;

  IF coach_profile_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = coach_profile_id) THEN
    RAISE EXCEPTION 'coach_profile_id % does not match an existing profile.', coach_profile_id;
  END IF;

  -- 2a. Verified head coach record on the school.
  INSERT INTO public.school_staff (school_id, user_id, role, is_verified)
  VALUES (v_school_id, coach_profile_id, 'coach', true)
  ON CONFLICT (school_id, user_id, role)
  DO UPDATE SET is_verified = true, updated_at = now();

  -- 2b. The school-based coaching team, owned by the coach.
  SELECT id INTO v_team_id
  FROM public.coaching_teams
  WHERE school_id = v_school_id AND name = 'WTAMU Rodeo Team'
  LIMIT 1;

  IF v_team_id IS NULL THEN
    INSERT INTO public.coaching_teams (name, description, team_type, school_id, owner_id)
    VALUES (
      'WTAMU Rodeo Team',
      'West Texas A&M University Rodeo Team — NIRA Caprock Region. Head Coach: Cody Bonds.',
      'school',
      v_school_id,
      coach_profile_id
    )
    RETURNING id INTO v_team_id;
  ELSE
    UPDATE public.coaching_teams
    SET owner_id = coach_profile_id, updated_at = now()
    WHERE id = v_team_id;
  END IF;

  RETURN v_team_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Auto-wire: if Cody Bonds already has an account, link him now.
--    Matches by email first, then by full name. If no match, the school page
--    still exists; call setup_wtamu_rodeo_team(<profile_id>) once he signs up.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_coach_id UUID;
BEGIN
  SELECT id INTO v_coach_id
  FROM public.profiles
  WHERE lower(email) = 'cody.bonds@wtamu.edu'
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    SELECT id INTO v_coach_id
    FROM public.profiles
    WHERE full_name ILIKE '%cody%bonds%' OR name ILIKE '%cody%bonds%'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_coach_id IS NOT NULL THEN
    PERFORM public.setup_wtamu_rodeo_team(v_coach_id);
    RAISE NOTICE 'WTAMU Rodeo Team wired to coach profile %', v_coach_id;
  ELSE
    RAISE NOTICE 'WTAMU school seeded. Coach Cody Bonds has no profile yet — run setup_wtamu_rodeo_team(<profile_id>) after he signs up.';
  END IF;
END;
$$;
