-- Ported from BarrelConnect migration 047_group_chats_enhancements.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

ALTER TABLE public.group_chats
  ADD COLUMN IF NOT EXISTS group_type TEXT DEFAULT 'custom'
    CHECK (group_type IN ('barn', 'team', 'friends', 'event', 'custom')),
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mute_settings JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_group_invites_user ON public.group_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_code ON public.group_invites(invite_code);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invited user or group members can view invites" ON public.group_invites
  FOR SELECT USING (
    auth.uid() = invited_user_id
    OR EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_invites.group_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can create invites" ON public.group_invites
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_invites.group_id AND user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Invited user can update invite" ON public.group_invites
  FOR UPDATE TO authenticated USING (auth.uid() = invited_user_id);
