-- Ported from BarrelConnect migration 060_add_app_settings_to_user_settings.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Extend user_settings with app-level settings

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS units TEXT NOT NULL DEFAULT 'imperial',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_units_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_units_check
      CHECK (units IN ('imperial', 'metric'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_language_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_language_check
      CHECK (language IN ('en', 'es', 'pt'));
  END IF;
END $$;
