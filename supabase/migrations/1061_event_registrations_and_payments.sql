-- Ported from BarrelConnect migration 061_event_registrations_and_payments.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Event registrations for rodeo events
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.rodeo_events(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES public.horses(id) ON DELETE SET NULL,
  horse_name TEXT NOT NULL,
  division TEXT NOT NULL,
  entry_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  registration_status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_required BOOLEAN NOT NULL DEFAULT false,
  racer_name TEXT,
  racer_email TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(registration_status);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;
CREATE POLICY "Users can view own registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own registrations" ON public.event_registrations;
CREATE POLICY "Users can insert own registrations"
  ON public.event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own registrations" ON public.event_registrations;
CREATE POLICY "Users can update own registrations"
  ON public.event_registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Producers can view registrations for their events
DROP POLICY IF EXISTS "Producers can view event registrations" ON public.event_registrations;
CREATE POLICY "Producers can view event registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rodeo_events e
      WHERE e.id = event_registrations.event_id AND e.producer_id = auth.uid()
    )
  );

-- Event payments (Stripe PaymentIntent tracking)
CREATE TABLE IF NOT EXISTS public.event_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_payments_registration ON public.event_payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_stripe ON public.event_payments(stripe_payment_intent_id);

ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event payments" ON public.event_payments;
CREATE POLICY "Users can view own event payments"
  ON public.event_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.id = event_payments.registration_id AND r.user_id = auth.uid()
    )
  );

-- Edge Functions use service_role key which bypasses RLS for inserts/updates
