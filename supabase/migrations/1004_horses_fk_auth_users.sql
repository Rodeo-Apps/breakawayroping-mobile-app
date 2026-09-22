-- Ported from BarrelConnect migration 004_horses_fk_auth_users.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Fix: "insert or update on table horses violates foreign key constraint fk_horses_user"
-- The horses table had user_id referencing public.users(id), but the app uses auth user ids
-- (profile?.id from auth.users). Dropping this FK lets inserts succeed.
--
-- Run in Supabase Dashboard -> SQL Editor.

ALTER TABLE public.horses DROP CONSTRAINT IF EXISTS fk_horses_user;
