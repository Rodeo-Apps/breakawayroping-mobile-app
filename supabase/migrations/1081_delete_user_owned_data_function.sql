-- Ported from BarrelConnect migration 081_delete_user_owned_data_function.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Removes public rows keyed by user_id that are NOT covered by ON DELETE CASCADE
-- from auth.users (e.g. runs, marketplace_listings). Invoked by Edge Function
-- delete-user-account before auth.admin.deleteUser().

CREATE OR REPLACE FUNCTION public.delete_user_owned_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user id';
  END IF;

  -- Saved listings (other users' listings this user saved)
  DELETE FROM public.listing_saves WHERE user_id = p_user_id;

  -- User's marketplace listings (cascades listing_photos for those listings)
  DELETE FROM public.marketplace_listings WHERE user_id = p_user_id;

  -- Video comparisons reference video_analyses — remove comparisons first
  DELETE FROM public.video_comparisons WHERE user_id = p_user_id;

  DELETE FROM public.video_analyses WHERE user_id = p_user_id;

  DELETE FROM public.ai_run_insights WHERE user_id = p_user_id;

  DELETE FROM public.runs WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_owned_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_owned_data(uuid) TO service_role;
