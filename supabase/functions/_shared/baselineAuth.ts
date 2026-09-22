/**
 * Auth + storage helpers for the baseline function.
 *
 * Mirrors the pattern the analysis functions use: permission checks run on a
 * client that carries the caller's JWT, because auth.uid() is NULL under the
 * service role and any RLS-backed check would otherwise reject everyone.
 */
// @ts-ignore - Deno edge runtime import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

export type SupabaseClient = ReturnType<typeof createClient>;

export type AuthedCaller = {
  userId: string;
  service: SupabaseClient;
  asUser: SupabaseClient;
};

export async function authenticate(req: Request): Promise<AuthedCaller> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await service.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  return {
    userId: user.id,
    service,
    asUser: createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    ),
  };
}

const PUBLIC_MARKER = "/storage/v1/object/public/";
const SIGN_MARKER = "/storage/v1/object/sign/";

function parseStorageRef(
  value: string,
  defaultBucket: string,
): { bucket: string; path: string } | null {
  if (!value) return null;
  for (const marker of [PUBLIC_MARKER, SIGN_MARKER]) {
    const at = value.indexOf(marker);
    if (at !== -1) {
      const rest = value.slice(at + marker.length).split("?")[0];
      const slash = rest.indexOf("/");
      if (slash <= 0) return null;
      return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
    }
  }
  if (!value.startsWith("http")) {
    return { bucket: defaultBucket, path: value.replace(/^\/+/, "") };
  }
  return null;
}

/** Sign a list of stored objects for the model. Unsignable entries are dropped. */
export async function signAll(
  service: SupabaseClient,
  values: string[],
  defaultBucket: string,
  expiresInSeconds = 900,
): Promise<string[]> {
  const signed = await Promise.all(
    values.map(async (value) => {
      const ref = parseStorageRef(value, defaultBucket);
      if (!ref) return value.startsWith("http") ? value : null;
      const { data, error } = await service.storage
        .from(ref.bucket)
        .createSignedUrl(ref.path, expiresInSeconds);
      if (error || !data?.signedUrl) {
        console.error(`Failed to sign ${ref.bucket}/${ref.path}:`, error?.message);
        return null;
      }
      return data.signedUrl;
    }),
  );
  return (signed as Array<string | null>).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}
