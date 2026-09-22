-- Ported from BarrelConnect migration 083_promo_codes.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Promo codes for time-limited or lifetime premium access (single-use per code).

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  duration_months INTEGER,
  is_lifetime BOOLEAN NOT NULL DEFAULT false,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_code_unique UNIQUE (code),
  CONSTRAINT promo_codes_duration_check CHECK (
  (is_lifetime = true AND duration_months IS NULL)
  OR (is_lifetime = false AND duration_months IS NOT NULL AND duration_months > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code_upper
  ON public.promo_codes (UPPER(code));

CREATE INDEX IF NOT EXISTS idx_promo_codes_is_used
  ON public.promo_codes (is_used)
  WHERE is_used = false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_lifetime_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_expires_at TIMESTAMPTZ;

INSERT INTO public.promo_codes (code, duration_months, is_lifetime)
VALUES
  ('BCMON3', 3, false),
  ('BCMON6', 6, false),
  ('BCMON9', 9, false),
  ('BCYEAR1', 12, false),
  ('BCLIFEA1', NULL, true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Promo codes are redeemed only through the RPC below (no direct client access).

CREATE OR REPLACE FUNCTION public.cleanup_expired_promo_access(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    promo_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id
    AND has_lifetime_access = false
    AND promo_expires_at IS NOT NULL
    AND promo_expires_at <= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_promo_access(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  expires_at TIMESTAMPTZ,
  is_lifetime BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_normalized_code TEXT;
  v_promo public.promo_codes%ROWTYPE;
  v_base TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Sign in required to redeem a promo code.'::TEXT, NULL::TIMESTAMPTZ, false;
    RETURN;
  END IF;

  v_normalized_code := UPPER(TRIM(p_code));
  IF v_normalized_code = '' THEN
    RETURN QUERY SELECT false, 'Enter a promo code.'::TEXT, NULL::TIMESTAMPTZ, false;
    RETURN;
  END IF;

  PERFORM public.cleanup_expired_promo_access(v_user_id);

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND has_lifetime_access = true
  ) THEN
    RETURN QUERY SELECT false, 'You already have lifetime access.'::TEXT, NULL::TIMESTAMPTZ, true;
    RETURN;
  END IF;

  SELECT *
  INTO v_promo
  FROM public.promo_codes
  WHERE UPPER(code) = v_normalized_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid promo code.'::TEXT, NULL::TIMESTAMPTZ, false;
    RETURN;
  END IF;

  IF v_promo.is_used THEN
    RETURN QUERY SELECT false, 'This promo code has already been used.'::TEXT, NULL::TIMESTAMPTZ, false;
    RETURN;
  END IF;

  UPDATE public.promo_codes
  SET
    is_used = true,
    used_by = v_user_id,
    used_at = now()
  WHERE id = v_promo.id;

  IF v_promo.is_lifetime THEN
    UPDATE public.profiles
    SET
      has_lifetime_access = true,
      promo_expires_at = NULL,
      updated_at = now()
    WHERE id = v_user_id;

    RETURN QUERY SELECT true, 'Lifetime access activated.'::TEXT, NULL::TIMESTAMPTZ, true;
    RETURN;
  END IF;

  SELECT promo_expires_at
  INTO v_base
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_base IS NOT NULL AND v_base > now() THEN
    v_new_expiry := v_base + (v_promo.duration_months || ' months')::INTERVAL;
  ELSE
    v_new_expiry := now() + (v_promo.duration_months || ' months')::INTERVAL;
  END IF;

  UPDATE public.profiles
  SET
    promo_expires_at = v_new_expiry,
    updated_at = now()
  WHERE id = v_user_id;

  RETURN QUERY SELECT true, 'Promo code redeemed successfully.'::TEXT, v_new_expiry, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT) TO authenticated;
