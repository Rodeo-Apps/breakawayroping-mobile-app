import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno edge runtime npm import
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Rotating pool of daily challenge ideas. The generator picks one per day,
// avoiding the most recent ones so the same challenge isn't repeated back to
// back.
const CHALLENGE_POOL: { title: string; description: string; points: number }[] = [
  { title: "Log a training run", description: "Record at least one timed run today.", points: 15 },
  { title: "Share a photo", description: "Post a photo of you or your horse to the feed.", points: 10 },
  { title: "Cheer a friend", description: "Like and comment on 3 posts from riders you follow.", points: 10 },
  { title: "Update a horse profile", description: "Add or update details on one of your horses.", points: 10 },
  { title: "Beat your best", description: "Log a run and try to beat your fastest recorded time.", points: 20 },
  { title: "Follow someone new", description: "Find and follow a new rider in the community.", points: 5 },
  { title: "Check the leaderboard", description: "See where you rank this week and plan your push.", points: 5 },
];

/**
 * generate-daily-challenge
 * Ensures a single daily_challenges row exists for today. Intended to run once
 * per day (pg_cron / scheduled) shortly after midnight. Idempotent: if today's
 * challenge already exists it does nothing.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

    // Already have today's challenge? Nothing to do.
    const { data: existing, error: existingError } = await supabase
      .from("daily_challenges")
      .select("id, title")
      .eq("challenge_date", today)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, created: false, challenge: existing }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Avoid repeating the titles used in the last 5 days.
    const { data: recent } = await supabase
      .from("daily_challenges")
      .select("title")
      .order("challenge_date", { ascending: false })
      .limit(5);
    const recentTitles = new Set((recent ?? []).map((r: { title: string }) => r.title));

    const candidates = CHALLENGE_POOL.filter((c) => !recentTitles.has(c.title));
    const pool = candidates.length > 0 ? candidates : CHALLENGE_POOL;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    const { data: inserted, error: insertError } = await supabase
      .from("daily_challenges")
      .insert({
        title: pick.title,
        description: pick.description,
        points: pick.points,
        challenge_date: today,
      })
      .select("id, title, description, points, challenge_date")
      .single();
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, created: true, challenge: inserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-daily-challenge error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
