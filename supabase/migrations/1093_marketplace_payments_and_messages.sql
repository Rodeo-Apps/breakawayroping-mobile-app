-- Ported from BarrelConnect migration 093_marketplace_payments_and_messages.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Rodeo Marketplace: payments, new categories, expiry, buyer/seller messaging
-- Run in Supabase Dashboard -> SQL Editor.
--
-- Extends the EXISTING marketplace (migrations 007/070) rather than replacing it,
-- so existing listings, photos and saves keep working. All changes are additive
-- and idempotent.

-- ---------------------------------------------------------------------------
-- 1. Payment + expiry columns on marketplace_listings
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'arrange_yourself',
  ADD COLUMN IF NOT EXISTS fee_split BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_handles JSONB,
  ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- payment_type: how the sale is settled.
--   'arrange_yourself' -> buyer & seller settle outside the app (Venmo/PayPal/
--                         CashApp/Zelle/cash). No money moves through Barrel Connect.
--   'stripe'           -> in-app Stripe checkout (physical goods only).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_payment_type_check'
  ) THEN
    ALTER TABLE public.marketplace_listings
      ADD CONSTRAINT marketplace_listings_payment_type_check
      CHECK (payment_type IN ('arrange_yourself', 'stripe'));
  END IF;
END $$;

COMMENT ON COLUMN public.marketplace_listings.payment_type IS
  'arrange_yourself (off-app: Venmo/PayPal/CashApp/Zelle/cash) or stripe (in-app checkout)';
COMMENT ON COLUMN public.marketplace_listings.fee_split IS
  'Stripe listings only: if true buyer & seller split the Stripe processing fee 50/50, otherwise buyer pays it in full';
COMMENT ON COLUMN public.marketplace_listings.payment_handles IS
  'arrange_yourself listings only: JSON of handles e.g. {"venmo":"@me","paypal":"me@x.com","cashapp":"$me","zelle":"555..."}';
COMMENT ON COLUMN public.marketplace_listings.accepts_cash IS
  'arrange_yourself listings only: seller accepts cash in person';
COMMENT ON COLUMN public.marketplace_listings.expires_at IS
  'Listing auto-expires 60 days after creation; renewable by the seller';

-- Backfill expiry for existing rows (60 days from their creation date).
UPDATE public.marketplace_listings
  SET expires_at = COALESCE(created_at, now()) + INTERVAL '60 days'
  WHERE expires_at IS NULL;

-- New rows default to now()+60d.
ALTER TABLE public.marketplace_listings
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '60 days');

-- ---------------------------------------------------------------------------
-- 2. Expand allowed categories (add saddle, gear, apparel, other; keep legacy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_category_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_category_check
  CHECK (category IN (
    'horse', 'saddle', 'tack', 'trailer', 'gear', 'apparel', 'other',
    -- legacy value from earlier migrations; kept so existing rows stay valid
    'service'
  ));

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_expires_at
  ON public.marketplace_listings(expires_at);

-- ---------------------------------------------------------------------------
-- 3. Optional order tracking for in-app (Stripe) purchases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_listing_id ON public.marketplace_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON public.marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_id ON public.marketplace_orders(seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_orders_pi
  ON public.marketplace_orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyer or seller can view own orders" ON public.marketplace_orders;
CREATE POLICY "Buyer or seller can view own orders"
  ON public.marketplace_orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Orders are written by the edge function (service role bypasses RLS); no
-- client-side insert/update policies are granted on purpose.

-- ---------------------------------------------------------------------------
-- 4. Buyer <-> seller messaging for listings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_messages_listing_id ON public.marketplace_messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_sender_id ON public.marketplace_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_recipient_id ON public.marketplace_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_created_at ON public.marketplace_messages(created_at DESC);

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view marketplace messages" ON public.marketplace_messages;
CREATE POLICY "Participants can view marketplace messages"
  ON public.marketplace_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send marketplace messages" ON public.marketplace_messages;
CREATE POLICY "Users can send marketplace messages"
  ON public.marketplace_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipient can mark marketplace messages read" ON public.marketplace_messages;
CREATE POLICY "Recipient can mark marketplace messages read"
  ON public.marketplace_messages FOR UPDATE
  USING (auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
-- 5. Dedicated storage bucket for marketplace photos
--    (existing 'listing-photos' bucket is preserved and still used; this adds
--     the bucket named in the marketplace spec for future/direct uploads)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-photos',
  'marketplace-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view marketplace photos" ON storage.objects;
CREATE POLICY "Public can view marketplace photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace-photos');

DROP POLICY IF EXISTS "Users can upload own marketplace photos" ON storage.objects;
CREATE POLICY "Users can upload own marketplace photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own marketplace photos" ON storage.objects;
CREATE POLICY "Users can delete own marketplace photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
