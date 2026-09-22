-- Ported from BarrelConnect migration 041_messages_receiver_id_to_recipient_id.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Align messages table with app: use recipient_id (app sends recipient_id)
-- If DB has receiver_id instead, rename to recipient_id.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'receiver_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id') THEN
    ALTER TABLE public.messages RENAME COLUMN receiver_id TO recipient_id;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'receiver_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id') THEN
    UPDATE public.messages SET recipient_id = receiver_id WHERE recipient_id IS NULL AND receiver_id IS NOT NULL;
    ALTER TABLE public.messages DROP COLUMN receiver_id;
  END IF;
END $$;
