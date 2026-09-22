-- Ported from BarrelConnect migration 086_horse_views.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 086_horse_views.sql
-- Quick Win #3: "X people viewed your horse today" notifications
--
-- Records each time a user opens another rider's horse profile, so a daily
-- digest Edge Function can tell owners how many people viewed their horse(s).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.horse_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id   UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horse_views_horse_viewed_at
  ON public.horse_views(horse_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_horse_views_viewed_at
  ON public.horse_views(viewed_at DESC);
-- Used to de-duplicate repeat views by the same person on the same day.
CREATE INDEX IF NOT EXISTS idx_horse_views_dedupe
  ON public.horse_views(horse_id, viewer_id, viewed_at);

ALTER TABLE public.horse_views ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can record a view (the helper RPC also guards against
-- self-views and same-day duplicates).
DROP POLICY IF EXISTS "Users can record horse views" ON public.horse_views;
CREATE POLICY "Users can record horse views"
  ON public.horse_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

-- Horse owners can read the views on their own horses.
DROP POLICY IF EXISTS "Owners can read views of their horses" ON public.horse_views;
CREATE POLICY "Owners can read views of their horses"
  ON public.horse_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.horses h
      WHERE h.id = horse_views.horse_id
        AND (h.owner_id = auth.uid() OR h.user_id = auth.uid())
    )
    OR viewer_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- RPC: record_horse_view — safe entry point used by the app.
-- Skips owner self-views and collapses multiple views by the same viewer on
-- the same UTC day into a single row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_horse_view(p_horse_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_owner  UUID;
BEGIN
  IF v_viewer IS NULL OR p_horse_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(owner_id, user_id) INTO v_owner FROM public.horses WHERE id = p_horse_id;

  -- Don't count the owner viewing their own horse.
  IF v_owner IS NULL OR v_owner = v_viewer THEN
    RETURN;
  END IF;

  -- One view per viewer per horse per day.
  IF EXISTS (
    SELECT 1 FROM public.horse_views
    WHERE horse_id = p_horse_id
      AND viewer_id = v_viewer
      AND viewed_at >= date_trunc('day', now())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.horse_views (horse_id, viewer_id) VALUES (p_horse_id, v_viewer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_horse_view(UUID) TO authenticated;
