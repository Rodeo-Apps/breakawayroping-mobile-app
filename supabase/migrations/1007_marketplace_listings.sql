-- Ported from BarrelConnect migration 007_marketplace_listings.sql
-- Adapted for breakawayroping-mobile-app (barrel-specific columns removed).
-- Idempotent; safe to re-run. Runs AFTER breakaway base migrations 001-007.

-- Marketplace: listings, listing_photos, listing_saves
-- Run in Supabase Dashboard -> SQL Editor so you can add listings from the app.

-- Listings table (aligns with MarketplaceScreen create form)
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('horse', 'tack', 'trailer', 'service')),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  condition TEXT,
  location_city TEXT,
  location_state TEXT,
  contact_phone BOOLEAN NOT NULL DEFAULT false,
  contact_email BOOLEAN NOT NULL DEFAULT true,
  contact_message BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'pending', 'removed')),
  sold_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  inquiries_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON public.marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON public.marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON public.marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price ON public.marketplace_listings(price);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active listings" ON public.marketplace_listings;
CREATE POLICY "Anyone can view active listings"
  ON public.marketplace_listings FOR SELECT
  USING (status = 'active' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own listings" ON public.marketplace_listings;
CREATE POLICY "Users can insert own listings"
  ON public.marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own listings" ON public.marketplace_listings;
CREATE POLICY "Users can update own listings"
  ON public.marketplace_listings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own listings" ON public.marketplace_listings;
CREATE POLICY "Users can delete own listings"
  ON public.marketplace_listings FOR DELETE
  USING (auth.uid() = user_id);

-- Listing photos (optional: for multiple images per listing)
CREATE TABLE IF NOT EXISTS public.listing_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_id ON public.listing_photos(listing_id);

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view listing photos" ON public.listing_photos;
CREATE POLICY "Anyone can view listing photos"
  ON public.listing_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage photos for own listings" ON public.listing_photos;
CREATE POLICY "Users can manage photos for own listings"
  ON public.listing_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_listings m
      WHERE m.id = listing_id AND m.user_id = auth.uid()
    )
  );

-- Saved listings (for "saved" view)
CREATE TABLE IF NOT EXISTS public.listing_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_saves_user_id ON public.listing_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_saves_listing_id ON public.listing_saves(listing_id);

ALTER TABLE public.listing_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saves" ON public.listing_saves;
CREATE POLICY "Users can view own saves"
  ON public.listing_saves FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saves" ON public.listing_saves;
CREATE POLICY "Users can insert own saves"
  ON public.listing_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saves" ON public.listing_saves;
CREATE POLICY "Users can delete own saves"
  ON public.listing_saves FOR DELETE
  USING (auth.uid() = user_id);
