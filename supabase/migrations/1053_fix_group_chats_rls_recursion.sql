-- Ported from BarrelConnect migration 053_fix_group_chats_rls_recursion.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix cross-table RLS recursion between group_chats and group_chat_members.
-- This rewrites policies to use SECURITY DEFINER helpers instead of
-- direct cross-table subqueries inside policy expressions.

CREATE OR REPLACE FUNCTION public.is_group_creator(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_chats
    WHERE id = p_group_id
      AND created_by = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Members can view group" ON public.group_chats;
DROP POLICY IF EXISTS "Admins can update group" ON public.group_chats;
DROP POLICY IF EXISTS "Admins can delete group" ON public.group_chats;

CREATE POLICY "Members can view group"
ON public.group_chats
FOR SELECT
USING (
  created_by = auth.uid()
  OR public.is_group_member(id, auth.uid())
);

CREATE POLICY "Admins can update group"
ON public.group_chats
FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.is_group_admin(id, auth.uid())
);

CREATE POLICY "Admins can delete group"
ON public.group_chats
FOR DELETE
USING (
  created_by = auth.uid()
  OR public.is_group_admin(id, auth.uid())
);

DROP POLICY IF EXISTS "Members can view group_chat_members" ON public.group_chat_members;
DROP POLICY IF EXISTS "Creator or admin can add members" ON public.group_chat_members;
DROP POLICY IF EXISTS "Admins or self can delete member" ON public.group_chat_members;

CREATE POLICY "Members can view group_chat_members"
ON public.group_chat_members
FOR SELECT
USING (
  public.is_group_creator(group_id, auth.uid())
  OR public.is_group_member(group_id, auth.uid())
);

CREATE POLICY "Creator or admin can add members"
ON public.group_chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_creator(group_id, auth.uid())
  OR public.is_group_admin(group_id, auth.uid())
);

CREATE POLICY "Admins or self can delete member"
ON public.group_chat_members
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_group_creator(group_id, auth.uid())
  OR public.is_group_admin(group_id, auth.uid())
);
