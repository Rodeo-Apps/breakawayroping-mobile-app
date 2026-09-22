import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore - Stripe types
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreatePaymentRequest {
  registrationId: string;
  amountCents: number;
  currency?: string;
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

    const body = (await req.json()) as CreatePaymentRequest;
    const { registrationId, amountCents, currency = "usd" } = body;

    if (!registrationId || typeof amountCents !== "number" || amountCents <= 0) {
      throw new Error("Invalid request: registrationId and amountCents (positive) required");
    }

    // Verify registration exists and belongs to user
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select("id, user_id, total_amount_cents, registration_status")
      .eq("id", registrationId)
      .single();

    if (regError || !registration) {
      throw new Error("Registration not found");
    }
    if (registration.user_id !== authData.user.id) {
      throw new Error("Unauthorized: registration does not belong to user");
    }
    if (registration.registration_status === "confirmed") {
      throw new Error("Registration is already confirmed");
    }
    if (amountCents !== registration.total_amount_cents) {
      throw new Error("Amount mismatch");
    }

    // Check for existing payment
    const { data: existingPayment } = await supabase
      .from("event_payments")
      .select("id, payment_status")
      .eq("registration_id", registrationId)
      .single();

    if (existingPayment?.payment_status === "succeeded") {
      throw new Error("Payment already completed");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        registration_id: registrationId,
        user_id: authData.user.id,
      },
    });

    // Upsert event_payments record
    const paymentRecord = {
      registration_id: registrationId,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      currency: currency.toLowerCase(),
      payment_status: "pending",
    };

    if (existingPayment) {
      await supabase
        .from("event_payments")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: "pending",
        })
        .eq("id", existingPayment.id);
    } else {
      await supabase.from("event_payments").insert(paymentRecord);
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("create-event-payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
