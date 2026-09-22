// Breakaway Roping takes ZERO platform commission on marketplace sales.
// The only add-on for in-app (Stripe) purchases is Stripe's own processing fee.
// Keep these constants in sync with supabase/functions/marketplace-checkout.
export const STRIPE_PERCENT = 0.029; // 2.9%
export const STRIPE_FIXED_CENTS = 30; // $0.30

export type T_MARKETPLACE_FEE_BREAKDOWN = {
  /** Listing price in cents. */
  basePriceCents: number;
  /** Full Stripe processing fee in cents. */
  stripeFeeCents: number;
  /** Portion of the fee the buyer pays (full fee, or half if split). */
  buyerFeeCents: number;
  /** Portion of the fee the seller absorbs (0, or half if split). */
  sellerFeeCents: number;
  /** Total the buyer is charged in cents. */
  buyerTotalCents: number;
  /** Net the seller receives in cents. */
  sellerNetCents: number;
};

/**
 * Compute the fee split for a Stripe marketplace sale.
 * @param price listing price in dollars
 * @param feeSplit if true, buyer & seller split the Stripe fee 50/50; otherwise
 *   the buyer pays the full fee.
 */
export const computeMarketplaceFees = (
  price: number,
  feeSplit: boolean,
): T_MARKETPLACE_FEE_BREAKDOWN => {
  const basePriceCents = Math.round((Number.isFinite(price) ? price : 0) * 100);
  const stripeFeeCents = Math.round(
    basePriceCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS,
  );
  const buyerFeeCents = feeSplit ? Math.round(stripeFeeCents / 2) : stripeFeeCents;
  const sellerFeeCents = stripeFeeCents - buyerFeeCents;
  return {
    basePriceCents,
    stripeFeeCents,
    buyerFeeCents,
    sellerFeeCents,
    buyerTotalCents: basePriceCents + buyerFeeCents,
    sellerNetCents: basePriceCents - sellerFeeCents,
  };
};

export const formatCents = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );

/** True when a usable Stripe publishable key is present in the environment. */
export const isStripeConfigured = (): boolean => {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return !!key && key.startsWith('pk_');
};
