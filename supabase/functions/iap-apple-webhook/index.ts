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

const decodeJwsPayloadUnsafe = <T>(jws: string): T => {
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

interface AppleRenewalPayload extends JsonObject {
  originalTransactionId?: string;
  productId?: string;
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
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

const fetchAppleSubscriptionStatus = async (
  originalTransactionId: string,
  environmentHint?: string | null,
): Promise<{
  environment: AppleEnvironment;
  signedTransactionInfo: string;
  signedRenewalInfo: string | null;
  transactionPayload: AppleTransactionPayload;
  renewalPayload: AppleRenewalPayload | null;
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
      `${getAppleApiBase(environment)}/inApps/v1/subscriptions/${originalTransactionId}`,
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
    const groups = (body?.data ?? []) as Array<{ lastTransactions?: Array<{ signedTransactionInfo?: string; signedRenewalInfo?: string }> }>;

    const allTransactions = groups.flatMap((group) => group.lastTransactions ?? []);
    if (allTransactions.length === 0) {
      throw new Error("Apple subscription response has no transactions");
    }

    let best: {
      signedTransactionInfo: string;
      signedRenewalInfo: string | null;
      transactionPayload: AppleTransactionPayload;
      renewalPayload: AppleRenewalPayload | null;
    } | null = null;

    for (const item of allTransactions) {
      if (!item.signedTransactionInfo) continue;
      const txPayload = decodeJwsPayloadUnsafe<AppleTransactionPayload>(item.signedTransactionInfo);
      const renewalPayload = item.signedRenewalInfo
        ? decodeJwsPayloadUnsafe<AppleRenewalPayload>(item.signedRenewalInfo)
        : null;
      if (!best || (txPayload.expiresDate ?? 0) > (best.transactionPayload.expiresDate ?? 0)) {
        best = {
          signedTransactionInfo: item.signedTransactionInfo,
          signedRenewalInfo: item.signedRenewalInfo ?? null,
          transactionPayload: txPayload,
          renewalPayload,
        };
      }
    }

    if (!best) {
      throw new Error("Apple subscription response contains no valid signed transactions");
    }

    return {
      environment,
      signedTransactionInfo: best.signedTransactionInfo,
      signedRenewalInfo: best.signedRenewalInfo,
      transactionPayload: best.transactionPayload,
      renewalPayload: best.renewalPayload,
    };
  }

  throw new Error(`Unable to fetch subscription status from Apple (${lastError || "no response"})`);
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

interface NotificationPayload {
  notificationUUID?: string;
  notificationType?: string;
  subtype?: string;
  data?: {
    appAppleId?: number;
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

const applyNotificationState = (args: {
  notificationType?: string;
  subtype?: string;
  tx: AppleTransactionPayload;
  renewal?: AppleRenewalPayload;
}) => {
  const now = Date.now();
  let status = args.tx.revocationDate
    ? "revoked"
    : (args.tx.expiresDate && args.tx.expiresDate <= now ? "expired" : "active");
  let isActive = isLikelyActive(args.tx);
  let autoRenewStatus = args.renewal?.autoRenewStatus == null ? null : args.renewal.autoRenewStatus === 1;

  switch (args.notificationType) {
    case "REFUND":
    case "REVOKE":
      status = "revoked";
      isActive = false;
      break;
    case "EXPIRED":
      status = "expired";
      isActive = false;
      break;
    case "DID_FAIL_TO_RENEW": {
      const grace = args.renewal?.gracePeriodExpiresDate ?? null;
      if (grace && grace > now) {
        status = "in_grace_period";
        isActive = true;
      } else {
        status = "billing_retry";
        isActive = false;
      }
      break;
    }
    case "DID_RENEW":
    case "SUBSCRIBED":
    case "OFFER_REDEEMED":
      status = "active";
      isActive = true;
      break;
    case "DID_CHANGE_RENEWAL_STATUS":
      if (args.subtype === "AUTO_RENEW_DISABLED") {
        autoRenewStatus = false;
      }
      if (args.subtype === "AUTO_RENEW_ENABLED") {
        autoRenewStatus = true;
      }
      break;
    default:
      break;
  }

  return { status, isActive, autoRenewStatus };
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

  const supabase = createServiceRoleClient();

  try {
    const body = await req.json();
    const signedPayload = body?.signedPayload as string | undefined;
    if (!signedPayload) {
      throw new Error("Missing signedPayload");
    }

    const notification = decodeJwsPayloadUnsafe<NotificationPayload>(signedPayload);
    const notificationUUID = notification.notificationUUID ?? crypto.randomUUID();
    const notificationType = notification.notificationType ?? null;
    const notificationSubtype = notification.subtype ?? null;

    const signedRenewalInfo = notification.data?.signedRenewalInfo ?? null;
    const renewal = signedRenewalInfo
      ? decodeJwsPayloadUnsafe<AppleRenewalPayload>(signedRenewalInfo)
      : null;

    const embeddedTx = notification.data?.signedTransactionInfo
      ? decodeJwsPayloadUnsafe<AppleTransactionPayload>(notification.data.signedTransactionInfo)
      : null;

    const transactionId = embeddedTx?.transactionId ?? null;
    const originalTransactionId = embeddedTx?.originalTransactionId ?? renewal?.originalTransactionId ?? null;

    const { error: eventInsertError } = await supabase.from("iap_events").insert({
      store: "app_store",
      notification_uuid: notificationUUID,
      event_type: notificationType,
      subtype: notificationSubtype,
      environment: notification.data?.environment ?? embeddedTx?.environment ?? null,
      original_transaction_id: originalTransactionId,
      transaction_id: transactionId,
      payload: notification,
      received_at: new Date().toISOString(),
    });

    if (eventInsertError) {
      if (eventInsertError.code === "23505") {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw eventInsertError;
    }

    if (!transactionId && !originalTransactionId) {
      throw new Error("Notification missing transaction identifiers");
    }

    const authoritativeTx = transactionId
      ? await fetchAppleTransaction(transactionId, notification.data?.environment ?? null)
      : null;
    const authoritativeSubscription = !authoritativeTx && originalTransactionId
      ? await fetchAppleSubscriptionStatus(originalTransactionId, notification.data?.environment ?? null)
      : null;

    const txPayload = authoritativeTx?.payload ??
      authoritativeSubscription?.transactionPayload ??
      embeddedTx;
    const effectiveRenewal = renewal ?? authoritativeSubscription?.renewalPayload ?? null;
    if (!txPayload || !txPayload.productId) {
      throw new Error("Unable to resolve transaction details");
    }

    const resolvedOriginalTx = txPayload.originalTransactionId ?? txPayload.transactionId ?? originalTransactionId;
    const resolvedTransactionId = txPayload.transactionId ?? transactionId;
    if (!resolvedOriginalTx || !resolvedTransactionId) {
      throw new Error("Resolved transaction identifiers are incomplete");
    }

    const appAccountToken = parseUuidOrNull(txPayload.appAccountToken);
    let userId: string | null = appAccountToken;
    if (!userId) {
      const { data: existingSubscription } = await supabase
        .from("iap_subscriptions")
        .select("user_id")
        .eq("original_transaction_id", resolvedOriginalTx)
        .maybeSingle();
      userId = existingSubscription?.user_id ?? null;
    }

    const entitlement = applyNotificationState({
      notificationType: notificationType ?? undefined,
      subtype: notificationSubtype ?? undefined,
      tx: txPayload,
      renewal: effectiveRenewal ?? undefined,
    });

    const { data: subscription, error: subscriptionError } = await supabase
      .from("iap_subscriptions")
      .upsert(
        {
          user_id: userId,
          platform: "ios",
          store: "app_store",
          product_id: txPayload.productId,
          original_transaction_id: resolvedOriginalTx,
          latest_transaction_id: resolvedTransactionId,
          purchase_token: notification.data?.signedTransactionInfo ??
            authoritativeTx?.signedTransactionInfo ??
            authoritativeSubscription?.signedTransactionInfo ??
            null,
          app_account_token: appAccountToken,
          status: entitlement.status,
          is_active: entitlement.isActive,
          auto_renew_status: entitlement.autoRenewStatus,
          purchase_date: toIsoOrNull(txPayload.purchaseDate),
          expires_at: toIsoOrNull(txPayload.expiresDate),
          grace_period_expires_at: toIsoOrNull(effectiveRenewal?.gracePeriodExpiresDate),
          canceled_at: notificationType === "EXPIRED" ? new Date().toISOString() : null,
          revoked_at: toIsoOrNull(txPayload.revocationDate),
          environment: txPayload.environment ?? notification.data?.environment ?? null,
          last_notification_type: notificationType,
          last_notification_subtype: notificationSubtype,
          raw_latest_transaction: txPayload,
          raw_latest_renewal_info: effectiveRenewal,
        },
        { onConflict: "original_transaction_id" },
      )
      .select("id, user_id")
      .single();

    if (subscriptionError || !subscription) {
      throw new Error(`Failed to upsert subscription: ${subscriptionError?.message ?? "unknown"}`);
    }

    const { error: txError } = await supabase
      .from("iap_transactions")
      .upsert(
        {
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          platform: "ios",
          store: "app_store",
          product_id: txPayload.productId,
          transaction_id: resolvedTransactionId,
          original_transaction_id: resolvedOriginalTx,
          purchase_token: notification.data?.signedTransactionInfo ??
            authoritativeTx?.signedTransactionInfo ??
            authoritativeSubscription?.signedTransactionInfo ??
            null,
          purchase_date: toIsoOrNull(txPayload.purchaseDate),
          expires_date: toIsoOrNull(txPayload.expiresDate),
          revocation_date: toIsoOrNull(txPayload.revocationDate),
          is_trial: false,
          offer_type: typeof txPayload.offerType === "number" ? String(txPayload.offerType) : null,
          environment: txPayload.environment ?? notification.data?.environment ?? null,
          raw_signed_transaction: authoritativeTx?.signedTransactionInfo ??
            authoritativeSubscription?.signedTransactionInfo ??
            notification.data?.signedTransactionInfo ??
            null,
          raw_payload: txPayload,
        },
        { onConflict: "transaction_id" },
      );
    if (txError) {
      throw new Error(`Failed to upsert transaction: ${txError.message}`);
    }

    if (subscription.user_id) {
      await supabase.rpc("sync_profile_premium_from_iap", { p_user_id: subscription.user_id });
    }

    await supabase
      .from("iap_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("notification_uuid", notificationUUID);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("iap-apple-webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
