-- Ported from BarrelConnect migration 110_horse_rider_baselines.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- ============================================================================
-- 110: The standing walk-around baseline.
-- ----------------------------------------------------------------------------
-- WHAT THIS IS FOR
-- A run filmed from the rail is measured in pixels, and pixels mean nothing:
-- a small horse close to the camera and a big horse far away look identical.
-- Every current output is therefore an adjective — "tight pocket", "good
-- posture" — which a coach cannot track across a season.
--
-- A walk-around fixes that. Filming a standing horse and rider head to hoof
-- from several angles, once, gives three things:
--
--   1. SCALE. Combined with one real measurement the owner already knows (the
--      horse's height in hands), the proportions in frame convert to inches.
--      "Sixteen inches off the first barrel" instead of "tight".
--   2. A PER-ATHLETE NORMAL. You cannot call a dropped shoulder a fault until
--      you know how she sits at rest. Without this we flag anatomy as error.
--   3. IDENTITY. A proportion embedding answers "which horse, which rider" when
--      twenty unlabelled clips arrive from a coach.
--
-- WHAT IT IS NOT
-- It is a calibration capture, not an analysis. A standing horse says nothing
-- about how the pair runs. Anything in the UI that implies otherwise is wrong.
--
-- Depends on: 036 (profiles), horses table, 081 (set_updated_at_timestamp).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Captures
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.horse_rider_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The pair. horse_id is optional so a rider can capture on a borrowed horse.
  horse_id UUID REFERENCES public.horses(id) ON DELETE SET NULL,
  horse_name TEXT,
  label TEXT,

  -- The one real-world measurement we ask for. Everything else is a ratio, and
  -- ratios alone cannot produce inches — this is what makes the capture metric
  -- rather than merely proportional.
  horse_height_hands NUMERIC(4, 2)
    CHECK (horse_height_hands IS NULL OR (horse_height_hands BETWEEN 8 AND 20)),
  rider_height_inches NUMERIC(5, 2)
    CHECK (rider_height_inches IS NULL OR (rider_height_inches BETWEEN 36 AND 90)),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'superseded')),
  failure_reason TEXT,

  -- Source media.
  video_storage_path TEXT,
  frame_paths TEXT[] NOT NULL DEFAULT '{}',
  view_labels TEXT[] NOT NULL DEFAULT '{}',

  -- Model output, all of it estimates. See 111 for the shape.
  measurements JSONB NOT NULL DEFAULT '{}'::jsonb,
  /* Scale-invariant proportion vector used to re-identify this pair in later
     footage. Stored as an array rather than a pgvector column so the migration
     does not depend on the extension; the sets are small enough that a plain
     cosine similarity in SQL is fine. */
  horse_embedding DOUBLE PRECISION[],
  rider_embedding DOUBLE PRECISION[],

  /* The measurement everything else is scaled by: withers height in inches,
     derived from the declared hands (1 hand = 4 inches). Every ratio the model
     returns multiplies by this to become inches. Asking the owner for the one
     number they already know is far more reliable than trying to read absolute
     size out of a photograph. NULL when no height was given — the capture is
     then proportional only. */
  scale_reference_inches NUMERIC(6, 2),

  -- How much any of this should be trusted.
  quality_score NUMERIC(4, 3) CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),
  quality_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4, 3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),

  /* Baselines go stale: horses change condition, riders change tack and grow.
     A capture past this date still works but should prompt a re-shoot. */
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recommended_recapture_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  analysis_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baselines_user ON public.horse_rider_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_baselines_horse ON public.horse_rider_baselines(horse_id);
CREATE INDEX IF NOT EXISTS idx_baselines_status ON public.horse_rider_baselines(status);

-- One active baseline per pair. A new capture supersedes the old one rather
-- than competing with it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_active_pair
  ON public.horse_rider_baselines(user_id, COALESCE(horse_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active AND status = 'completed';

DROP TRIGGER IF EXISTS trg_baselines_set_updated_at ON public.horse_rider_baselines;
CREATE TRIGGER trg_baselines_set_updated_at
BEFORE UPDATE ON public.horse_rider_baselines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.horse_rider_baselines ENABLE ROW LEVEL SECURITY;

-- A baseline is body measurements of a person and their horse. Owner only.
DROP POLICY IF EXISTS "Users manage own baselines" ON public.horse_rider_baselines;
CREATE POLICY "Users manage own baselines"
ON public.horse_rider_baselines
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Private storage for the capture and its frames.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('baseline-captures', 'baseline-captures', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owners read own baseline captures" ON storage.objects;
CREATE POLICY "Owners read own baseline captures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'baseline-captures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners write own baseline captures" ON storage.objects;
CREATE POLICY "Owners write own baseline captures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'baseline-captures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners delete own baseline captures" ON storage.objects;
CREATE POLICY "Owners delete own baseline captures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'baseline-captures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- 3. Run analyses can cite the baseline they were measured against.
-- ----------------------------------------------------------------------------
ALTER TABLE public.video_analyses
  ADD COLUMN IF NOT EXISTS baseline_id UUID
    REFERENCES public.horse_rider_baselines(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.video_analyses.baseline_id IS
  'Baseline used to scale this run. NULL means the analysis is proportional only — no inches.';

-- ----------------------------------------------------------------------------
-- 4. Superseding, and the active baseline lookup.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_baseline(
  p_user_id UUID,
  p_horse_id UUID DEFAULT NULL
)
RETURNS SETOF public.horse_rider_baselines
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.horse_rider_baselines b
  WHERE b.user_id = p_user_id
    AND b.status = 'completed'
    AND b.is_active
    AND (p_horse_id IS NULL OR b.horse_id = p_horse_id OR b.horse_id IS NULL)
  -- Prefer a baseline captured on this exact horse over a generic one.
  ORDER BY (b.horse_id IS NOT DISTINCT FROM p_horse_id) DESC, b.captured_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_baseline(UUID, UUID) TO authenticated;

/* Retire the previous baseline for a pair. Called after a new capture
   completes, so the unique index above never has two winners. */
CREATE OR REPLACE FUNCTION public.supersede_previous_baselines(p_baseline_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.horse_rider_baselines%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO r FROM public.horse_rider_baselines WHERE id = p_baseline_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baseline not found'; END IF;

  UPDATE public.horse_rider_baselines
  SET status = 'superseded', is_active = false, updated_at = now()
  WHERE user_id = r.user_id
    AND id <> r.id
    AND is_active
    AND status = 'completed'
    AND horse_id IS NOT DISTINCT FROM r.horse_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.supersede_previous_baselines(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Identity: match an unlabelled run against known baselines.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.embedding_cosine_similarity(
  a DOUBLE PRECISION[],
  b DOUBLE PRECISION[]
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dot DOUBLE PRECISION := 0;
  v_na DOUBLE PRECISION := 0;
  v_nb DOUBLE PRECISION := 0;
  v_len INTEGER;
  i INTEGER;
BEGIN
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  v_len := LEAST(array_length(a, 1), array_length(b, 1));
  IF v_len IS NULL OR v_len = 0 THEN RETURN NULL; END IF;

  FOR i IN 1..v_len LOOP
    v_dot := v_dot + (a[i] * b[i]);
    v_na  := v_na + (a[i] * a[i]);
    v_nb  := v_nb + (b[i] * b[i]);
  END LOOP;

  IF v_na = 0 OR v_nb = 0 THEN RETURN NULL; END IF;
  RETURN v_dot / (sqrt(v_na) * sqrt(v_nb));
END;
$$;

COMMENT ON FUNCTION public.embedding_cosine_similarity(DOUBLE PRECISION[], DOUBLE PRECISION[]) IS
  'Cosine similarity between two proportion embeddings. NULL when either is missing or zero.';

/* Rank the caller's baselines against an embedding taken from a run, so an
   unlabelled clip can be attributed. Deliberately scoped to the caller's own
   baselines: this is a convenience, not a way to identify strangers. */
CREATE OR REPLACE FUNCTION public.match_baseline_by_embedding(
  p_embedding DOUBLE PRECISION[],
  p_subject TEXT DEFAULT 'horse',
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  baseline_id UUID,
  horse_id UUID,
  horse_name TEXT,
  label TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    b.id,
    b.horse_id,
    b.horse_name,
    b.label,
    public.embedding_cosine_similarity(
      p_embedding,
      CASE WHEN p_subject = 'rider' THEN b.rider_embedding ELSE b.horse_embedding END
    ) AS similarity
  FROM public.horse_rider_baselines b
  WHERE b.user_id = auth.uid()
    AND b.status = 'completed'
    AND (CASE WHEN p_subject = 'rider' THEN b.rider_embedding ELSE b.horse_embedding END) IS NOT NULL
  ORDER BY similarity DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 5), 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_baseline_by_embedding(DOUBLE PRECISION[], TEXT, INTEGER)
  TO authenticated;
