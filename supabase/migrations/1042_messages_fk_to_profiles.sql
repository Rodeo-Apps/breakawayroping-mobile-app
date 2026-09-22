-- Ported from BarrelConnect migration 042_messages_fk_to_profiles.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Point messages FKs to profiles (app uses profile IDs from auth/profiles, not public.users)
-- Drop FKs that reference public.users; add FKs to public.profiles(id) only if missing.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS fk_messages_sender;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS fk_messages_recipient;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_sender_id_fkey') THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_recipient_id_fkey') THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
