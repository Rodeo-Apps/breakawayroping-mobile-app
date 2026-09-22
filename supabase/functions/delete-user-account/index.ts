import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime import
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKETS_USER_PREFIX = [
  "horse-photos",
  "avatars",
  "run-videos",
  "listing-photos",
  "video-frames",
] as const;

async function removeObjectsUnderPrefix(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<void> {
  const prefix = `${userId}`;
  const { data: entries, error: listError } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (listError) {
    console.warn(`delete-user-account: list ${bucket}/${prefix}:`, listError.message);
    return;
  }

  if (!entries?.length) return;

  const paths = entries.filter((e) => e.name).map((e) => `${prefix}/${e.name}`);
  if (paths.length === 0) return;

  const { error: removeError } = await admin.storage.from(bucket).remove(paths);
  if (removeError) {
    console.warn(`delete-user-account: remove ${bucket}:`, removeError.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.id) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { error: rpcError } = await admin.rpc("delete_user_owned_data", {
      p_user_id: userId,
    });

    if (rpcError) {
      console.error("delete_user_owned_data:", rpcError);
      return new Response(
        JSON.stringify({
          error: rpcError.message || "Failed to remove user data",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const bucket of STORAGE_BUCKETS_USER_PREFIX) {
      await removeObjectsUnderPrefix(admin, bucket, userId);
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("auth.admin.deleteUser:", deleteAuthError);
      return new Response(
        JSON.stringify({
          error: deleteAuthError.message || "Failed to delete auth user",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("delete-user-account:", e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
