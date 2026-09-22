import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

interface JsonObject {
  [key: string]: unknown;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const createServiceRoleClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceRoleKey);
};

const base64UrlToBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + padding;
};

const decodeJwsPayloadUnsafe = <T extends JsonObject>(jws: string): T => {
  const parts = jws.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWS token");
  }
  const json = atob(base64UrlToBase64(parts[1]));
  return JSON.parse(json) as T;
};

const base64UrlEncode = (input: string | Uint8Array): string => {
  const raw = typeof input === "string" ? btoa(input) : btoa(String.fromCharCode(...input));
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const derLength = (bytes: Uint8Array, offset: number): { length: number; bytesUsed: number } => {
  const first = bytes[offset];
  if ((first & 0x80) === 0) {
    return { length: first, bytesUsed: 1 };
  }
  const count = first & 0x7f;
  let length = 0;
  for (let i = 0; i < count; i += 1) {
    length = (length << 8) | bytes[offset + 1 + i];
  }
  return { length, bytesUsed: 1 + count };
};

const derEcdsaToJose = (derSignature: Uint8Array, partLength = 32): string => {
  if (derSignature[0] !== 0x30) {
    throw new Error("Invalid DER signature format");
  }
  const seqLength = derLength(derSignature, 1);
  let offset = 1 + seqLength.bytesUsed;

  if (derSignature[offset] !== 0x02) {
    throw new Error("Invalid DER signature (R marker)");
  }
  const rLen = derLength(derSignature, offset + 1);
  const rStart = offset + 1 + rLen.bytesUsed;
  const r = derSignature.slice(rStart, rStart + rLen.length);
  offset = rStart + rLen.length;

  if (derSignature[offset] !== 0x02) {
    throw new Error("Invalid DER signature (S marker)");
  }
  const sLen = derLength(derSignature, offset + 1);
  const sStart = offset + 1 + sLen.bytesUsed;
  const s = derSignature.slice(sStart, sStart + sLen.length);

  const normalizePart = (part: Uint8Array): Uint8Array => {
    let normalized = part;
    while (normalized.length > 0 && normalized[0] === 0x00) {
      normalized = normalized.slice(1);
    }
    if (normalized.length > partLength) {
      throw new Error("Invalid ECDSA signature part length");
    }
    const padded = new Uint8Array(partLength);
    padded.set(normalized, partLength - normalized.length);
    return padded;
  };

  const jose = new Uint8Array(partLength * 2);
  jose.set(normalizePart(r), 0);
  jose.set(normalizePart(s), partLength);
  return base64UrlEncode(jose);
};

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const createAppleApiJwt = async (): Promise<string> => {
  const issuerId = Deno.env.get("APPLE_ISSUER_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKeyRaw = Deno.env.get("APPLE_PRIVATE_KEY");

  if (!issuerId || !keyId || !privateKeyRaw) {
    throw new Error("Missing APPLE_ISSUER_ID, APPLE_KEY_ID, or APPLE_PRIVATE_KEY");
  }

  const privateKeyPem = privateKeyRaw.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: "appstoreconnect-v1",
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${derEcdsaToJose(new Uint8Array(signature))}`;
};

type AppleEnvironment = "Production" | "Sandbox";

interface AppleTransactionPayload extends JsonObject {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  bundleId?: string;
  environment?: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  inAppOwnershipType?: string;
  offerType?: string;
}

const getAppleApiBase = (environment: AppleEnvironment): string =>
  environment === "Sandbox"
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";

const fetchAppleTransaction = async (
  transactionId: string,
  environmentHint?: string | null,
): Promise<{
  environment: AppleEnvironment;
  signedTransactionInfo: string;
  payload: AppleTransactionPayload;
}> => {
  const first: AppleEnvironment = environmentHint?.toLowerCase().includes("sandbox")
    ? "Sandbox"
    : "Production";
  const fallbacks: AppleEnvironment[] = first === "Production"
    ? ["Production", "Sandbox"]
    : ["Sandbox", "Production"];
  const token = await createAppleApiJwt();

  let lastError = "";
  for (const environment of fallbacks) {
    const response = await fetch(
      `${getAppleApiBase(environment)}/inApps/v1/transactions/${transactionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      lastError = `${environment}: ${response.status}`;
      continue;
    }

    const body = await response.json();
    const signedTransactionInfo = body?.signedTransactionInfo as string | undefined;
    if (!signedTransactionInfo) {
      throw new Error("Apple transaction response missing signedTransactionInfo");
    }

    const payload = decodeJwsPayloadUnsafe<AppleTransactionPayload>(signedTransactionInfo);
    return { environment, signedTransactionInfo, payload };
  }

  throw new Error(`Unable to fetch transaction from Apple (${lastError || "no response"})`);
};

const toIsoOrNull = (value?: number | null): string | null => {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  return new Date(value).toISOString();
};

const parseUuidOrNull = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  );
  return isUuid ? normalized : null;
};

const isLikelyActive = (payload: AppleTransactionPayload): boolean => {
  if (payload.revocationDate) {
    return false;
  }
  if (!payload.expiresDate) {
    return true;
  }
  return payload.expiresDate > Date.now();
};

interface VerifyPurchaseBody {
  purchaseToken?: string | null;
  transactionId?: string | null;
  productId?: string | null;
  environment?: string | null;
}

const getAllowedSkus = (): string[] =>
  (String(Deno.env.get("APPLE_ALLOWED_SUBSCRIPTION_SKUS") ?? ""))
    .split(",")
    .map((sku: string) => sku.trim())
    .filter(Boolean);

const computeStatus = (tx: AppleTransactionPayload): string => {
  if (tx.revocationDate) return "revoked";
  if (!tx.expiresDate) return "active";
  if (tx.expiresDate <= Date.now()) return "expired";
  return "active";
};

const extractTransactionId = (body: VerifyPurchaseBody): string | null => {
  if (body.transactionId) {
    return body.transactionId;
  }
  if (!body.purchaseToken) {
    return null;
  }
  const decoded = decodeJwsPayloadUnsafe<AppleTransactionPayload>(body.purchaseToken);
  return decoded.transactionId ?? null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createServiceRoleClient();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) {
      throw new Error("Unauthorized");
    }
    const userId = authData.user.id;

    const body = (await req.json()) as VerifyPurchaseBody;
    const transactionId = extractTransactionId(body);
    if (!transactionId) {
      throw new Error("Missing transaction identifier");
    }

    const apple = await fetchAppleTransaction(transactionId, body.environment ?? null);
    const tx = apple.payload;

    const expectedBundleId = Deno.env.get("APPLE_BUNDLE_ID");
    if (expectedBundleId && tx.bundleId && tx.bundleId !== expectedBundleId) {
      throw new Error("Bundle ID mismatch");
    }

    const allowedSkus = getAllowedSkus();
    if (allowedSkus.length > 0 && tx.productId && !allowedSkus.includes(tx.productId)) {
      throw new Error("Product is not part of premium catalog");
    }

    const appAccountToken = parseUuidOrNull(tx.appAccountToken);
    if (appAccountToken && appAccountToken !== userId) {
      throw new Error("Purchase belongs to a different user account");
    }

    const originalTransactionId = tx.originalTransactionId ?? tx.transactionId;
    if (!originalTransactionId || !tx.transactionId || !tx.productId) {
      throw new Error("Apple payload missing required fields");
    }

    const status = computeStatus(tx);
    const isActive = isLikelyActive(tx);

    const { data: subscription, error: subscriptionError } = await supabase
      .from("iap_subscriptions")
      .upsert(
        {
          user_id: userId,
          platform: "ios",
          store: "app_store",
          product_id: tx.productId,
          original_transaction_id: originalTransactionId,
          latest_transaction_id: tx.transactionId,
          purchase_token: body.purchaseToken ?? apple.signedTransactionInfo,
          app_account_token: appAccountToken,
          status,
          is_active: isActive,
          purchase_date: toIsoOrNull(tx.purchaseDate),
          expires_at: toIsoOrNull(tx.expiresDate),
          revoked_at: toIsoOrNull(tx.revocationDate),
          environment: tx.environment ?? apple.environment,
          raw_latest_transaction: tx,
          last_notification_type: "CLIENT_VERIFY",
          last_notification_subtype: null,
        },
        { onConflict: "original_transaction_id" },
      )
      .select("id, product_id, status, is_active, expires_at, original_transaction_id, latest_transaction_id")
      .single();

    if (subscriptionError || !subscription) {
      throw new Error(`Failed to upsert subscription: ${subscriptionError?.message ?? "unknown"}`);
    }

    const { error: txError } = await supabase
      .from("iap_transactions")
      .upsert(
        {
          user_id: userId,
          subscription_id: subscription.id,
          platform: "ios",
          store: "app_store",
          product_id: tx.productId,
          transaction_id: tx.transactionId,
          original_transaction_id: originalTransactionId,
          purchase_token: body.purchaseToken ?? apple.signedTransactionInfo,
          purchase_date: toIsoOrNull(tx.purchaseDate),
          expires_date: toIsoOrNull(tx.expiresDate),
          revocation_date: toIsoOrNull(tx.revocationDate),
          is_trial: tx.offerType === 1, // 1 = Apple introductory offer (free trial)
          offer_type: typeof tx.offerType === "number" ? String(tx.offerType) : null,
          environment: tx.environment ?? apple.environment,
          raw_signed_transaction: apple.signedTransactionInfo,
          raw_payload: tx,
        },
        { onConflict: "transaction_id" },
      );

    if (txError) {
      throw new Error(`Failed to upsert transaction: ${txError.message}`);
    }

    const { data: profileSync, error: profileSyncError } = await supabase.rpc(
      "sync_profile_premium_from_iap",
      { p_user_id: userId },
    );
    if (profileSyncError) {
      throw new Error(`Failed to sync premium profile: ${profileSyncError.message}`);
    }

    const synced = Array.isArray(profileSync) ? profileSync[0] : profileSync;

    return new Response(
      JSON.stringify({
        success: true,
        is_premium: synced?.is_premium ?? subscription.is_active,
        premium_expires_at: synced?.premium_expires_at ?? subscription.expires_at ?? null,
        subscription: {
          original_transaction_id: subscription.original_transaction_id,
          latest_transaction_id: subscription.latest_transaction_id,
          product_id: subscription.product_id,
          status: subscription.status,
          is_active: subscription.is_active,
          expires_at: subscription.expires_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("iap-verify-client-purchase error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
