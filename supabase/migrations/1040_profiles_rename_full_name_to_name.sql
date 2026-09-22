-- Ported from BarrelConnect migration 040_profiles_rename_full_name_to_name.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Migrate full_name to name for existing profiles tables (run after 039)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name') THEN
      UPDATE public.profiles SET name = COALESCE(name, full_name) WHERE full_name IS NOT NULL;
      ALTER TABLE public.profiles DROP COLUMN full_name;
    ELSE
      ALTER TABLE public.profiles RENAME COLUMN full_name TO name;
    END IF;
  END IF;
END $$;
