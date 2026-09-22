// @ts-ignore - Deno edge runtime import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

export type JsonObject = Record<string, unknown>;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export const createServiceRoleClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceRoleKey);
};

const base64UrlToBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + padding;
};

export const decodeJwsPayloadUnsafe = <T extends JsonObject>(jws: string): T => {
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

const getAppleApiBase = (environment: AppleEnvironment): string =>
  environment === "Sandbox"
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";

export interface AppleTransactionPayload extends JsonObject {
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

export interface AppleRenewalPayload extends JsonObject {
  originalTransactionId?: string;
  productId?: string;
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
}

export const fetchAppleTransaction = async (
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

export const fetchAppleSubscriptionStatus = async (
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

export const toIsoOrNull = (value?: number | null): string | null => {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  return new Date(value).toISOString();
};

export const parseUuidOrNull = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  );
  return isUuid ? normalized : null;
};

export const isLikelyActive = (payload: AppleTransactionPayload): boolean => {
  if (payload.revocationDate) {
    return false;
  }
  if (!payload.expiresDate) {
    return true;
  }
  return payload.expiresDate > Date.now();
};
