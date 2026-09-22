-- Ported from BarrelConnect migration 038_group_chats_tables.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Group chats and members for Messages screen group conversations
-- Referenced by GroupChatScreen, CreateGroupScreen

CREATE TABLE IF NOT EXISTS public.group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_members_group_id ON public.group_chat_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_id ON public.group_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages(created_at);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- group_chats: members can view, creator can update/delete
CREATE POLICY "Members can view group" ON public.group_chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_chats.id AND user_id = auth.uid()));
CREATE POLICY "Authenticated can create group" ON public.group_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update group" ON public.group_chats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_chats.id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete group" ON public.group_chats FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_chats.id AND user_id = auth.uid() AND role = 'admin'));

-- group_chat_members: members of the group can view; creator or admin can add; self or admin can remove
CREATE POLICY "Members can view group_chat_members" ON public.group_chat_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_chat_members gcm WHERE gcm.group_id = group_chat_members.group_id AND gcm.user_id = auth.uid()));
CREATE POLICY "Creator or admin can add members" ON public.group_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_chat_members.group_id AND created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.group_chat_members gcm WHERE gcm.group_id = group_chat_members.group_id AND gcm.user_id = auth.uid() AND gcm.role = 'admin')
    )
  );
CREATE POLICY "Admins or self can delete member" ON public.group_chat_members FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_chat_members gcm WHERE gcm.group_id = group_chat_members.group_id AND gcm.user_id = auth.uid() AND gcm.role = 'admin'));

-- group_messages: members can view/insert
CREATE POLICY "Members can view group_messages" ON public.group_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()));
CREATE POLICY "Members can send group_messages" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()));

-- message_read_receipts: members can view; users can insert/update own receipts
CREATE POLICY "Members can view read receipts" ON public.message_read_receipts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_messages gm JOIN public.group_chat_members gcm ON gcm.group_id = gm.group_id WHERE gm.id = message_read_receipts.message_id AND gcm.user_id = auth.uid()));
CREATE POLICY "Users can insert own read receipts" ON public.message_read_receipts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own read receipts" ON public.message_read_receipts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
