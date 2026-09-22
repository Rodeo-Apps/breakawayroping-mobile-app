import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime npm import
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore - CommonJS package import shape in edge runtime
import { RtcRole, RtcTokenBuilder } from "npm:agora-access-token@2.0.4";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AgoraRole = "publisher" | "subscriber";

interface AgoraTokenRequest {
  channelName?: string;
  role?: AgoraRole;
  uid?: number;
}

const createServiceRoleClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceRoleKey);
};

const isValidChannelName = (value: string): boolean => {
  // Agora allows up to 64 bytes; keeping an app-level subset for safety.
  return /^[a-zA-Z0-9_-]{3,64}$/.test(value);
};

const toRtcRole = (role: AgoraRole) => {
  return role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
};

const generateUid = (): number => {
  // Keep UID in a safe 32-bit positive range for Agora SDK.
  return Math.floor(Math.random() * 2147483646) + 1;
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
    const appId = Deno.env.get("AGORA_APP_ID") ?? "";
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE") ?? "";
    const ttlSeconds = Number(Deno.env.get("AGORA_TOKEN_TTL_SECONDS") ?? "3600");

    if (!appId || appId.length !== 32) {
      throw new Error("Missing or invalid AGORA_APP_ID");
    }
    if (!appCertificate || appCertificate.length !== 32) {
      throw new Error("Missing or invalid AGORA_APP_CERTIFICATE");
    }

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

    const body = (await req.json()) as AgoraTokenRequest;
    const channelName = String(body.channelName ?? "").trim();
    const role = body.role ?? "subscriber";
    const uid = Number.isInteger(body.uid) && (body.uid as number) > 0
      ? (body.uid as number)
      : generateUid();

    if (!isValidChannelName(channelName)) {
      throw new Error("Invalid channelName. Use 3-64 chars: letters, numbers, underscore, hyphen.");
    }
    if (role !== "publisher" && role !== "subscriber") {
      throw new Error("Invalid role. Expected publisher or subscriber.");
    }

    const now = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = now + Math.max(60, ttlSeconds);
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      toRtcRole(role),
      privilegeExpireTs,
    );

    return new Response(
      JSON.stringify({
        success: true,
        appId,
        channelName,
        uid,
        role,
        token,
        expiresAt: privilegeExpireTs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("agora-token error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
