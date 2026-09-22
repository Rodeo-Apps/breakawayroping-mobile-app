-- Ported from BarrelConnect migration 065_horses_feed_read_policy.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix horses visibility for feed cards
-- Current policy allows only owner to read horses.
-- Feed cards may reference horses owned by other users, so authenticated users
-- need read access to horses that are attached to public posts.

-- 1) Backfill owner_id for old rows where legacy user_id existed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'horses'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      UPDATE public.horses
      SET owner_id = user_id
      WHERE owner_id IS NULL
        AND user_id IS NOT NULL
    ';
  END IF;
END
$$;

-- 2) Keep owner-only policy, and add feed-read policy.
DROP POLICY IF EXISTS "Authenticated can view horses in public feed" ON public.horses;
CREATE POLICY "Authenticated can view horses in public feed"
  ON public.horses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.horse_id = horses.id
        AND p.privacy = 'public'
    )
  );
