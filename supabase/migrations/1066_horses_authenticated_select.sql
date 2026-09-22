-- Ported from BarrelConnect migration 066_horses_authenticated_select.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Ensure app users can read horse details from feed/home
-- Dashboard SQL editor can return rows even when client-side RLS blocks them.
-- This policy allows authenticated users to SELECT horses.

DROP POLICY IF EXISTS "Authenticated can view all horses" ON public.horses;
CREATE POLICY "Authenticated can view all horses"
  ON public.horses FOR SELECT
  TO authenticated
  USING (true);
