-- Ported from BarrelConnect migration 067_group_chat_members_update_policy.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Allow group creators and admins to update member rows (e.g. promote/demote role).
-- Without this policy, UPDATE succeeds with 0 rows affected under RLS and the UI never refreshes.

DROP POLICY IF EXISTS "Creator or admin can update group_chat_members" ON public.group_chat_members;

CREATE POLICY "Creator or admin can update group_chat_members"
ON public.group_chat_members
FOR UPDATE
TO authenticated
USING (
  public.is_group_creator(group_id, auth.uid())
  OR public.is_group_admin(group_id, auth.uid())
)
WITH CHECK (
  public.is_group_creator(group_id, auth.uid())
  OR public.is_group_admin(group_id, auth.uid())
);
