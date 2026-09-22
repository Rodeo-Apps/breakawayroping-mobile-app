-- Ported from BarrelConnect migration 064_posts_repost_count.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Add repost_count to posts and keep it in sync

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS repost_count INTEGER;

ALTER TABLE public.posts
ALTER COLUMN repost_count SET DEFAULT 0;

UPDATE public.posts
SET repost_count = 0
WHERE repost_count IS NULL;

ALTER TABLE public.posts
ALTER COLUMN repost_count SET NOT NULL;

-- Backfill repost counts from already shared posts
UPDATE public.posts p
SET repost_count = sub.repost_count
FROM (
  SELECT
    shared_post_id,
    COUNT(*)::INTEGER AS repost_count
  FROM public.posts
  WHERE shared_post_id IS NOT NULL
    AND is_shared = true
  GROUP BY shared_post_id
) sub
WHERE p.id = sub.shared_post_id;

CREATE OR REPLACE FUNCTION public.refresh_repost_count(target_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF target_post_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.posts p
  SET repost_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.posts rp
    WHERE rp.shared_post_id = target_post_id
      AND rp.is_shared = true
  )
  WHERE p.id = target_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_repost_count_on_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_shared = true AND NEW.shared_post_id IS NOT NULL THEN
      PERFORM public.refresh_repost_count(NEW.shared_post_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.shared_post_id IS DISTINCT FROM NEW.shared_post_id
      OR OLD.is_shared IS DISTINCT FROM NEW.is_shared THEN
      IF OLD.shared_post_id IS NOT NULL THEN
        PERFORM public.refresh_repost_count(OLD.shared_post_id);
      END IF;
      IF NEW.shared_post_id IS NOT NULL THEN
        PERFORM public.refresh_repost_count(NEW.shared_post_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_shared = true AND OLD.shared_post_id IS NOT NULL THEN
      PERFORM public.refresh_repost_count(OLD.shared_post_id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_repost_count_on_posts ON public.posts;

CREATE TRIGGER trg_sync_repost_count_on_posts
AFTER INSERT OR UPDATE OF shared_post_id, is_shared OR DELETE
ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.sync_repost_count_on_posts();
