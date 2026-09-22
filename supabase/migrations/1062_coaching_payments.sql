-- Ported from BarrelConnect migration 062_coaching_payments.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Payments for coaching session bookings
CREATE TABLE IF NOT EXISTS public.coaching_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.coaching_bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_payments_booking ON public.coaching_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_coaching_payments_stripe ON public.coaching_payments(stripe_payment_intent_id);

ALTER TABLE public.coaching_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coaching payments" ON public.coaching_payments;
CREATE POLICY "Users can view own coaching payments"
  ON public.coaching_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaching_bookings b
      WHERE b.id = coaching_payments.booking_id AND b.user_id = auth.uid()
    )
  );

