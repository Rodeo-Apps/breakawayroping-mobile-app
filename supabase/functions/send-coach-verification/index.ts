/**
 * send-coach-verification Edge Function
 *
 * Issues a coach verification code and emails it to the coach's school email.
 *
 * Flow:
 *   1. Auth the caller (JWT forwarded from the app).
 *   2. Call the `request_coach_verification(school_id, email, role)` RPC, which
 *      creates an (unverified) school_staff row + a hashed code, and returns the
 *      raw 6-digit code to THIS trusted server context only.
 *   3. Email the code to the coach using a pluggable provider:
 *        - Resend  (RESEND_API_KEY)  — preferred
 *        - SendGrid (SENDGRID_API_KEY)
 *      If no provider is configured, the function still succeeds and returns
 *      `emailed: false` so the app can show the code-entry screen; an in-app
 *      path/manual fallback can be used. The raw code is NEVER returned to the
 *      client.
 *
 * The app then calls `confirm_coach_verification(request_id, code)` (directly via
 * supabase.rpc) once the coach types the code in.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  school_id: string;
  email: string;
  role?: "coach" | "assistant_coach" | "admin" | "staff";
  school_name?: string;
}

const FROM_EMAIL = Deno.env.get("VERIFICATION_FROM_EMAIL") ?? "no-reply@breakawayroping.pro";
const APP_NAME = "BreakawayRoping";

function emailHtml(code: string, schoolName?: string): string {
  const where = schoolName ? ` for <strong>${schoolName}</strong>` : "";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;">
    <h2 style="color:#640817;">${APP_NAME} Coach Verification</h2>
    <p>Use this code to verify your coaching role${where}:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f4f4f5;padding:16px;text-align:center;border-radius:8px;">
      ${code}
    </div>
    <p style="color:#71717a;font-size:13px;">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
}

async function sendViaResend(apiKey: string, to: string, code: string, schoolName?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Your ${APP_NAME} coach verification code`,
      html: emailHtml(code, schoolName),
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

async function sendViaSendgrid(apiKey: string, to: string, code: string, schoolName?: string) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: APP_NAME },
      subject: `Your ${APP_NAME} coach verification code`,
      content: [{ type: "text/html", value: emailHtml(code, schoolName) }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid failed: ${res.status} ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Run the RPC AS THE CALLER so auth.uid() is correct and RLS applies.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = (await req.json()) as RequestBody;
    if (!body?.school_id || !body?.email) {
      return new Response(JSON.stringify({ error: "school_id and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("request_coach_verification", {
      p_school_id: body.school_id,
      p_email: body.email,
      p_role: body.role ?? "coach",
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const requestId: string = row?.request_id;
    const code: string = row?.code;
    const expiresAt: string = row?.expires_at;

    // Try to email the code. Never block verification if email isn't configured.
    let emailed = false;
    let emailError: string | null = null;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const sgKey = Deno.env.get("SENDGRID_API_KEY");
      if (resendKey) {
        await sendViaResend(resendKey, body.email, code, body.school_name);
        emailed = true;
      } else if (sgKey) {
        await sendViaSendgrid(sgKey, body.email, code, body.school_name);
        emailed = true;
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }

    // IMPORTANT: do not return the raw code to the client.
    return new Response(
      JSON.stringify({ request_id: requestId, expires_at: expiresAt, emailed, email_error: emailError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
