import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore - Stripe types
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateCheckoutRequest {
  listingId: string;
  currency?: string;
}

// Stripe standard card processing fee: 2.9% + $0.30.
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

/**
 * Breakaway Roping charges ZERO platform commission on marketplace sales.
 * The only add-on is Stripe's own processing fee. By default the buyer covers
 * that fee; if the seller enabled fee_split, buyer and seller split it 50/50.
 */
const computeAmounts = (basePriceCents: number, feeSplit: boolean) => {
  const stripeFee = Math.round(basePriceCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS);
  const buyerFeeShare = feeSplit ? Math.round(stripeFee / 2) : stripeFee;
  const amountCents = basePriceCents + buyerFeeShare;
  return { stripeFee, buyerFeeShare, amountCents };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) {
      throw new Error("Unauthorized");
    }
    const buyerId = authData.user.id;

    const body = (await req.json()) as CreateCheckoutRequest;
    const { listingId, currency = "usd" } = body;

    if (!listingId) {
      throw new Error("Invalid request: listingId is required");
    }

    // Fetch the listing and validate it can be purchased in-app.
    const { data: listing, error: listErr } = await supabase
      .from("marketplace_listings")
      .select("id, user_id, title, price, status, payment_type, fee_split")
      .eq("id", listingId)
      .single();

    if (listErr || !listing) {
      throw new Error("Listing not found");
    }
    if (listing.payment_type !== "stripe") {
      throw new Error("This listing is not set up for in-app payment");
    }
    if (listing.status !== "active") {
      throw new Error("This listing is no longer available");
    }
    if (listing.user_id === buyerId) {
      throw new Error("You cannot buy your own listing");
    }

    const basePriceCents = Math.round(Number(listing.price) * 100);
    if (!Number.isFinite(basePriceCents) || basePriceCents <= 0) {
      throw new Error("Listing has an invalid price");
    }

    const { stripeFee, buyerFeeShare, amountCents } = computeAmounts(
      basePriceCents,
      !!listing.fee_split,
    );

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        listing_id: listing.id,
        buyer_id: buyerId,
        seller_id: listing.user_id,
        base_price_cents: String(basePriceCents),
        buyer_fee_cents: String(buyerFeeShare),
        stripe_fee_cents: String(stripeFee),
        fee_split: listing.fee_split ? "true" : "false",
      },
    });

    // Record a pending order (idempotent on the payment intent id).
    const { data: existingOrder } = await supabase
      .from("marketplace_orders")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", buyerId)
      .eq("payment_status", "pending")
      .maybeSingle();

    const orderRow = {
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: listing.user_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      fee_cents: buyerFeeShare,
      currency: currency.toLowerCase(),
      payment_status: "pending",
    };

    if (existingOrder) {
      await supabase
        .from("marketplace_orders")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          amount_cents: amountCents,
          fee_cents: buyerFeeShare,
          payment_status: "pending",
        })
        .eq("id", existingOrder.id);
    } else {
      await supabase.from("marketplace_orders").insert(orderRow);
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents,
        buyerFeeCents: buyerFeeShare,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("marketplace-checkout error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
