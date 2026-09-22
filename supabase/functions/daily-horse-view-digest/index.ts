import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime npm import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

const isValidExpoToken = (token: unknown): token is string =>
  typeof token === "string" && /^Expo(nent)?PushToken\[.+\]$/.test(token.trim());

/**
 * daily-horse-view-digest
 * Aggregates the last 24h of public.horse_views per horse, then tells each
 * owner how many people viewed their horse(s). Inserts an in-app notification
 * and sends an Expo push. Intended to run once daily (pg_cron / scheduled).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Pull the last 24h of views.
    const { data: views, error: viewsError } = await supabase
      .from("horse_views")
      .select("horse_id, viewer_id, viewed_at")
      .gte("viewed_at", since);

    if (viewsError) throw viewsError;

    if (!views || views.length === 0) {
      return new Response(
        JSON.stringify({ success: true, owners_notified: 0, note: "No horse views in the last 24h" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve horse -> owner + name.
    const horseIds = [...new Set(views.map((v: { horse_id: string }) => v.horse_id))];
    const { data: horses, error: horsesError } = await supabase
      .from("horses")
      .select("id, name, owner_id, user_id")
      .in("id", horseIds);
    if (horsesError) throw horsesError;

    const horseInfo = new Map<string, { ownerId: string | null; name: string }>();
    for (const h of horses ?? []) {
      horseInfo.set(h.id, { ownerId: h.owner_id ?? h.user_id ?? null, name: h.name ?? "your horse" });
    }

    // Aggregate distinct viewers per owner (and remember a representative horse name).
    const perOwner = new Map<string, { viewers: Set<string>; horseName: string; horseCount: Set<string> }>();
    for (const v of views as { horse_id: string; viewer_id: string }[]) {
      const info = horseInfo.get(v.horse_id);
      if (!info?.ownerId) continue;
      if (info.ownerId === v.viewer_id) continue; // safety: skip self-views
      const entry = perOwner.get(info.ownerId) ?? {
        viewers: new Set<string>(),
        horseName: info.name,
        horseCount: new Set<string>(),
      };
      entry.viewers.add(v.viewer_id);
      entry.horseCount.add(v.horse_id);
      perOwner.set(info.ownerId, entry);
    }

    if (perOwner.size === 0) {
      return new Response(
        JSON.stringify({ success: true, owners_notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ownerIds = [...perOwner.keys()];

    // Build notification rows.
    const notificationRows = ownerIds.map((ownerId) => {
      const entry = perOwner.get(ownerId)!;
      const count = entry.viewers.size;
      const people = count === 1 ? "person" : "people";
      const subject = entry.horseCount.size > 1 ? "your horses" : entry.horseName;
      const body = `${count} ${people} viewed ${subject} today`;
      return {
        user_id: ownerId,
        type: "horse_view",
        title: "Horse profile views",
        body,
        data: { view_count: count, horses: [...entry.horseCount] },
      };
    });

    const { error: insertError } = await supabase.from("notifications").insert(notificationRows);
    if (insertError) throw insertError;

    // Send pushes to owners with valid tokens.
    const { data: ownerProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, push_token")
      .in("id", ownerIds);
    if (profilesError) throw profilesError;

    const tokenById = new Map<string, string>();
    for (const p of ownerProfiles ?? []) {
      if (isValidExpoToken(p.push_token)) tokenById.set(p.id, p.push_token);
    }

    const messages = notificationRows
      .filter((row) => tokenById.has(row.user_id))
      .map((row) => ({
        to: tokenById.get(row.user_id)!,
        sound: "default",
        title: row.title,
        body: row.body,
        data: row.data,
        priority: "high",
      }));

    let pushResult: unknown = null;
    if (messages.length > 0) {
      const resp = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      pushResult = await resp.json();
    }

    return new Response(
      JSON.stringify({ success: true, owners_notified: ownerIds.length, pushes_sent: messages.length, pushResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("daily-horse-view-digest error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
