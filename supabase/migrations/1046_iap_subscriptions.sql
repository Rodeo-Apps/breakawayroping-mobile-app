-- Ported from BarrelConnect migration 046_iap_subscriptions.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Apple IAP subscription backend model.
-- Source of truth for premium entitlement should be iap_subscriptions, with profiles denormalized for fast reads.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.iap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL DEFAULT 'app_store',
  notification_uuid TEXT UNIQUE NOT NULL,
  event_type TEXT,
  subtype TEXT,
  environment TEXT,
  original_transaction_id TEXT,
  transaction_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_iap_events_received_at
  ON public.iap_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_iap_events_transaction_id
  ON public.iap_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_iap_events_original_transaction_id
  ON public.iap_events(original_transaction_id);

CREATE TABLE IF NOT EXISTS public.iap_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  store TEXT NOT NULL DEFAULT 'app_store',
  product_id TEXT NOT NULL,
  original_transaction_id TEXT UNIQUE NOT NULL,
  latest_transaction_id TEXT,
  purchase_token TEXT,
  app_account_token UUID,
  status TEXT NOT NULL DEFAULT 'unknown',
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_renew_status BOOLEAN,
  purchase_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  grace_period_expires_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  environment TEXT,
  last_notification_type TEXT,
  last_notification_subtype TEXT,
  raw_latest_transaction JSONB,
  raw_latest_renewal_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iap_subscriptions_user_id
  ON public.iap_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_subscriptions_active
  ON public.iap_subscriptions(is_active, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_iap_subscriptions_original_transaction_id
  ON public.iap_subscriptions(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_iap_subscriptions_latest_transaction_id
  ON public.iap_subscriptions(latest_transaction_id);

CREATE TABLE IF NOT EXISTS public.iap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.iap_subscriptions(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  store TEXT NOT NULL DEFAULT 'app_store',
  product_id TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  original_transaction_id TEXT NOT NULL,
  purchase_token TEXT,
  purchase_date TIMESTAMPTZ,
  expires_date TIMESTAMPTZ,
  revocation_date TIMESTAMPTZ,
  is_trial BOOLEAN NOT NULL DEFAULT false,
  offer_type TEXT,
  environment TEXT,
  raw_signed_transaction TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iap_transactions_user_id
  ON public.iap_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_subscription_id
  ON public.iap_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_original_transaction_id
  ON public.iap_transactions(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_product_id
  ON public.iap_transactions(product_id);

CREATE OR REPLACE FUNCTION public.touch_iap_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_iap_subscriptions_updated_at ON public.iap_subscriptions;
CREATE TRIGGER trg_touch_iap_subscriptions_updated_at
  BEFORE UPDATE ON public.iap_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_iap_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION public.sync_profile_premium_from_iap(p_user_id UUID)
RETURNS TABLE(is_premium BOOLEAN, premium_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_expiry TIMESTAMPTZ;
BEGIN
  SELECT MAX(COALESCE(expires_at, grace_period_expires_at))
  INTO v_latest_expiry
  FROM public.iap_subscriptions
  WHERE user_id = p_user_id
    AND is_active = true
    AND revoked_at IS NULL
    AND (
      (expires_at IS NOT NULL AND expires_at > now())
      OR (grace_period_expires_at IS NOT NULL AND grace_period_expires_at > now())
    );

  UPDATE public.profiles
  SET
    is_premium = v_latest_expiry IS NOT NULL,
    premium_expires_at = v_latest_expiry,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT v_latest_expiry IS NOT NULL, v_latest_expiry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile_premium_from_iap(UUID) TO authenticated, service_role;

ALTER TABLE public.iap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iap_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own iap subscriptions" ON public.iap_subscriptions;
CREATE POLICY "Users can view own iap subscriptions"
  ON public.iap_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own iap transactions" ON public.iap_transactions;
CREATE POLICY "Users can view own iap transactions"
  ON public.iap_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
