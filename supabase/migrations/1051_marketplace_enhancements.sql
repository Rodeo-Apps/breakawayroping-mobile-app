-- Ported from BarrelConnect migration 051_marketplace_enhancements.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Review helpful votes
CREATE TABLE IF NOT EXISTS public.listing_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.listing_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Price history tracking
CREATE TABLE IF NOT EXISTS public.listing_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-track price changes
CREATE OR REPLACE FUNCTION public.track_listing_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.listing_price_history (listing_id, old_price, new_price)
    VALUES (NEW.id, OLD.price, NEW.price);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_listing_price_change ON public.marketplace_listings;
CREATE TRIGGER on_listing_price_change
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.track_listing_price_change();

-- Marketplace payments
CREATE TABLE IF NOT EXISTS public.marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('card', 'bank', 'apple_pay', 'google_pay')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed')),
  stripe_payment_intent_id TEXT,
  escrow_released BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Listing analytics
CREATE TABLE IF NOT EXISTS public.listing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'save', 'share', 'message', 'call', 'offer')),
  viewer_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_reviews_listing ON public.listing_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_seller ON public.listing_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review ON public.review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_listing_price_history_listing ON public.listing_price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_listing ON public.marketplace_payments(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_buyer ON public.marketplace_payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_listing ON public.listing_analytics(listing_id);

ALTER TABLE public.listing_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_analytics ENABLE ROW LEVEL SECURITY;

-- Reviews
CREATE POLICY "Anyone can view reviews" ON public.listing_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated can create reviews" ON public.listing_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update own reviews" ON public.listing_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);

-- Helpful votes
CREATE POLICY "Anyone can view helpful votes" ON public.review_helpful_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote helpful" ON public.review_helpful_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own vote" ON public.review_helpful_votes FOR DELETE USING (auth.uid() = user_id);

-- Price history
CREATE POLICY "Anyone can view price history" ON public.listing_price_history FOR SELECT USING (true);

-- Payments
CREATE POLICY "Buyer or seller can view payments" ON public.marketplace_payments FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers can create payments" ON public.marketplace_payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Analytics
CREATE POLICY "Seller can view own listing analytics" ON public.listing_analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketplace_listings WHERE id = listing_analytics.listing_id AND user_id = auth.uid()));
CREATE POLICY "Anyone can log analytics" ON public.listing_analytics FOR INSERT TO authenticated WITH CHECK (true);
