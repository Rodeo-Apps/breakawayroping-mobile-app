-- Ported from BarrelConnect migration 063_arenas_owner_id_and_rls.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Adds ownership column for arenas and tightens RLS so users can only
-- update/delete their own arenas.

-- 1) Schema change
ALTER TABLE public.arenas
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default owner for existing rows / inserts that don't explicitly set owner_id.
-- auth.uid() is evaluated per request.
ALTER TABLE public.arenas
ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- (Optional) add an index for faster ownership checks.
CREATE INDEX IF NOT EXISTS idx_arenas_owner_id ON public.arenas(owner_id);

-- 2) RLS policy updates
-- Drop old policies that allow UPDATE/DELETE for everyone (authenticated).
DROP POLICY IF EXISTS "Authenticated users can update arenas" ON public.arenas;
DROP POLICY IF EXISTS "Authenticated users can delete arenas" ON public.arenas;
DROP POLICY IF EXISTS "Authenticated users can insert arenas" ON public.arenas;

-- Keep the existing public SELECT policy, but ensure authenticated users can still select.
-- (No change required for SELECT policies.)

-- INSERT: allow authenticated users to insert with owner_id = auth.uid().
CREATE POLICY "Authenticated users can insert own arenas"
  ON public.arenas FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: allow only the owner to update.
CREATE POLICY "Owners can update own arenas"
  ON public.arenas FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- DELETE: allow only the owner to delete.
CREATE POLICY "Owners can delete own arenas"
  ON public.arenas FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

