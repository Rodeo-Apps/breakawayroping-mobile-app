import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime npm import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendPushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Build a short-lived OAuth2 access token from a Firebase service account JSON.
// FCM HTTP v1 API requires this — the old server key is deprecated.
async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const toBase64Url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${toBase64Url(header)}.${toBase64Url(claim)}`;

  const pemBody = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const keyDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "";
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";

    if (!firebaseServiceAccountJson || !firebaseProjectId) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID secrets");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const payload: SendPushPayload = await req.json();
    const { user_id, title, body, data = {} } = payload;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch recipient's FCM token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile?.push_token) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getFirebaseAccessToken(firebaseServiceAccountJson);

    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: profile.push_token,
            notification: { title, body },
            // data values must all be strings
            data: Object.fromEntries(
              Object.entries({ type: "general", ...data }).map(([k, v]) => [k, String(v)])
            ),
            android: {
              priority: "high",
              notification: {
                sound: "default",
              },
            },
            apns: {
              headers: { "apns-priority": "10" },
              payload: {
                aps: { sound: "default", badge: 1 },
              },
            },
          },
        }),
      },
    );

    const fcmResult = await fcmRes.json();

    if (!fcmRes.ok) {
      // If the token is invalid/stale, clear it from the profile so we don't keep trying
      const errorStatus = fcmResult?.error?.details?.[0]?.errorCode;
      if (errorStatus === "UNREGISTERED" || errorStatus === "INVALID_ARGUMENT") {
        await supabase
          .from("profiles")
          .update({ push_token: null })
          .eq("id", user_id);
      }
      throw new Error(fcmResult?.error?.message ?? "FCM send failed");
    }

    return new Response(
      JSON.stringify({ success: true, message_id: fcmResult.name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[send-push-notification] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
