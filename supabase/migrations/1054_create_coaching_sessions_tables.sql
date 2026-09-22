-- Ported from BarrelConnect migration 054_create_coaching_sessions_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Coaching marketplace tables used by CoachingSessionsScreen

CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL DEFAULT 'one-on-one'
    CHECK (session_type IN ('live', 'recorded', 'group', 'one-on-one')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  max_participants INTEGER NOT NULL DEFAULT 1 CHECK (max_participants > 0),
  current_participants INTEGER NOT NULL DEFAULT 0 CHECK (current_participants >= 0),
  session_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  meeting_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coaching_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.coaching_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_date
  ON public.coaching_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_available_date
  ON public.coaching_sessions(is_available, session_date);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach
  ON public.coaching_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coaching_bookings_user
  ON public.coaching_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_bookings_session
  ON public.coaching_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_bookings_status
  ON public.coaching_bookings(booking_status);

-- Keep current_participants in sync with active bookings.
CREATE OR REPLACE FUNCTION public.refresh_coaching_session_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_session_id UUID;
BEGIN
  target_session_id := COALESCE(NEW.session_id, OLD.session_id);

  UPDATE public.coaching_sessions cs
  SET
    current_participants = (
      SELECT COUNT(*)
      FROM public.coaching_bookings cb
      WHERE cb.session_id = target_session_id
        AND cb.booking_status IN ('pending', 'confirmed')
    ),
    updated_at = now()
  WHERE cs.id = target_session_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_coaching_participants_on_ins ON public.coaching_bookings;
CREATE TRIGGER trg_refresh_coaching_participants_on_ins
AFTER INSERT ON public.coaching_bookings
FOR EACH ROW EXECUTE FUNCTION public.refresh_coaching_session_participants();

DROP TRIGGER IF EXISTS trg_refresh_coaching_participants_on_upd ON public.coaching_bookings;
CREATE TRIGGER trg_refresh_coaching_participants_on_upd
AFTER UPDATE OF booking_status ON public.coaching_bookings
FOR EACH ROW EXECUTE FUNCTION public.refresh_coaching_session_participants();

DROP TRIGGER IF EXISTS trg_refresh_coaching_participants_on_del ON public.coaching_bookings;
CREATE TRIGGER trg_refresh_coaching_participants_on_del
AFTER DELETE ON public.coaching_bookings
FOR EACH ROW EXECUTE FUNCTION public.refresh_coaching_session_participants();

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Anyone can view coaching sessions"
  ON public.coaching_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Coaches can create sessions" ON public.coaching_sessions;
CREATE POLICY "Coaches can create sessions"
  ON public.coaching_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "Coaches can update own sessions" ON public.coaching_sessions;
CREATE POLICY "Coaches can update own sessions"
  ON public.coaching_sessions FOR UPDATE
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "Coaches can delete own sessions" ON public.coaching_sessions;
CREATE POLICY "Coaches can delete own sessions"
  ON public.coaching_sessions FOR DELETE
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "Users can view own bookings and coaches can view session bookings" ON public.coaching_bookings;
CREATE POLICY "Users can view own bookings and coaches can view session bookings"
  ON public.coaching_bookings FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.coaching_sessions cs
      WHERE cs.id = coaching_bookings.session_id
        AND cs.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own bookings" ON public.coaching_bookings;
CREATE POLICY "Users can create own bookings"
  ON public.coaching_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookings and coaches can manage bookings" ON public.coaching_bookings;
CREATE POLICY "Users can update own bookings and coaches can manage bookings"
  ON public.coaching_bookings FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.coaching_sessions cs
      WHERE cs.id = coaching_bookings.session_id
        AND cs.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own bookings and coaches can delete bookings" ON public.coaching_bookings;
CREATE POLICY "Users can delete own bookings and coaches can delete bookings"
  ON public.coaching_bookings FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.coaching_sessions cs
      WHERE cs.id = coaching_bookings.session_id
        AND cs.coach_id = auth.uid()
    )
  );
