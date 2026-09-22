-- Ported from BarrelConnect migration 052_fix_group_chat_members_rls_recursion.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix recursive RLS policies on group_chat_members.
-- Previous policies queried group_chat_members from within its own policy checks,
-- which can trigger "infinite recursion detected in policy".

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_chat_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_chat_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Members can view group_chat_members" ON public.group_chat_members;
DROP POLICY IF EXISTS "Creator or admin can add members" ON public.group_chat_members;
DROP POLICY IF EXISTS "Admins or self can delete member" ON public.group_chat_members;

CREATE POLICY "Members can view group_chat_members"
ON public.group_chat_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_chats gc
    WHERE gc.id = group_chat_members.group_id
      AND gc.created_by = auth.uid()
  )
  OR public.is_group_member(group_chat_members.group_id, auth.uid())
);

CREATE POLICY "Creator or admin can add members"
ON public.group_chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_chats gc
    WHERE gc.id = group_chat_members.group_id
      AND (
        gc.created_by = auth.uid()
        OR public.is_group_admin(group_chat_members.group_id, auth.uid())
      )
  )
);

CREATE POLICY "Admins or self can delete member"
ON public.group_chat_members
FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.group_chats gc
    WHERE gc.id = group_chat_members.group_id
      AND gc.created_by = auth.uid()
  )
  OR public.is_group_admin(group_chat_members.group_id, auth.uid())
);
