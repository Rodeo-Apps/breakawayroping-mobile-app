-- Ported from BarrelConnect migration 034_draw_positions_table.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Creates draw_positions table for rider draw/order at rodeo events
-- Used by MyDrawPosition component and LiveResults

CREATE TABLE IF NOT EXISTS public.draw_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.rodeo_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draw_number INTEGER NOT NULL,
  estimated_run_time TIMESTAMPTZ,
  has_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draw_positions_event_id ON public.draw_positions(event_id);
CREATE INDEX IF NOT EXISTS idx_draw_positions_user_id ON public.draw_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_draw_positions_has_completed ON public.draw_positions(has_completed);
CREATE INDEX IF NOT EXISTS idx_draw_positions_event_user ON public.draw_positions(event_id, user_id);

-- RLS
ALTER TABLE public.draw_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view draw positions for events they're in" ON public.draw_positions;
CREATE POLICY "Users can view draw positions for events they're in"
  ON public.draw_positions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own draw position" ON public.draw_positions;
CREATE POLICY "Users can insert own draw position"
  ON public.draw_positions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own draw position" ON public.draw_positions;
CREATE POLICY "Users can update own draw position"
  ON public.draw_positions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own draw position" ON public.draw_positions;
CREATE POLICY "Users can delete own draw position"
  ON public.draw_positions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RPC: number of riders ahead of the given user in the event (not yet completed, lower draw number)
CREATE OR REPLACE FUNCTION public.calculate_riders_ahead(p_event_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_draw INTEGER;
  riders_ahead INTEGER;
BEGIN
  SELECT draw_number INTO my_draw
  FROM public.draw_positions
  WHERE event_id = p_event_id AND user_id = p_user_id AND has_completed = false
  LIMIT 1;

  IF my_draw IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO riders_ahead
  FROM public.draw_positions
  WHERE event_id = p_event_id
    AND has_completed = false
    AND draw_number < my_draw;

  RETURN COALESCE(riders_ahead, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_riders_ahead(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_riders_ahead(UUID, UUID) TO anon;
