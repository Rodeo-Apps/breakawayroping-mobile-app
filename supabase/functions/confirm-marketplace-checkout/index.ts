import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore - Stripe types
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConfirmCheckoutRequest {
  paymentIntentId: string;
}

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

    const body = (await req.json()) as ConfirmCheckoutRequest;
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      throw new Error("paymentIntentId is required");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    const listingId = paymentIntent.metadata?.listing_id;
    const buyerId = paymentIntent.metadata?.buyer_id;
    if (!listingId || !buyerId) {
      throw new Error("Invalid payment metadata");
    }
    if (buyerId !== authData.user.id) {
      throw new Error("Unauthorized: payment does not belong to user");
    }

    const now = new Date().toISOString();

    await supabase
      .from("marketplace_orders")
      .update({
        payment_status: "succeeded",
        paid_at: now,
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    // Mark the listing as sold now that payment succeeded.
    const { error: updateError } = await supabase
      .from("marketplace_listings")
      .update({
        status: "sold",
        sold_at: now,
        updated_at: now,
      })
      .eq("id", listingId);

    if (updateError) {
      console.error("Failed to update listing:", updateError);
      throw new Error("Failed to finalize purchase");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment confirmed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("confirm-marketplace-checkout error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
