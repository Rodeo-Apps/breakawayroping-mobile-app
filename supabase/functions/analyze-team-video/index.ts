import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// analyze-team-video edge function for breakawayroping.
//
// Coach-facing analysis: a coach submits an athlete's run video for the team.
// Adapts the single-athlete analyze-video schema for a team/coaching context —
// it adds coaching cues and a roster-relative note. Results are written back to
// the team_video_analyses row (status processing -> complete/failed) using the
// service role key so the coach's device can poll the row.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeTeamRequest {
  analysis_id: string;
  team_id: string;
  video_url: string;
  frame_urls?: string[];
  athlete_name?: string;
  event_type?: string;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_valid_run",
    "confidence",
    "overall_score",
    "summary",
    "phases",
    "strengths",
    "improvements",
    "drills",
    "coaching_cues",
  ],
  properties: {
    is_valid_run: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    overall_score: { type: "number" },
    summary: { type: "string" },
    phases: { type: "object" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    drills: { type: "array", items: { type: "string" } },
    coaching_cues: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT =
  "You are an expert breakawayroping coach reviewing a roster athlete's run for a coaching team. " +
  "Analyze the athlete's run from the supplied frames. Score the run out of 100, summarize what " +
  "happened, break down each phase, and give concrete strengths, improvements, drills, and short " +
  "coaching cues a coach can shout in the practice pen. Respond ONLY with JSON matching the schema.";

async function markFailed(admin: any, analysisId: string, message: string) {
  if (!admin || !analysisId) return;
  await admin
    .from("team_video_analyses")
    .update({ status: "failed", result_json: { error: message } })
    .eq("id", analysisId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  let analysisId = "";

  try {
    const body = (await req.json()) as AnalyzeTeamRequest;
    const { analysis_id, video_url, frame_urls, athlete_name } = body;
    analysisId = analysis_id;

    if (!video_url && (!frame_urls || frame_urls.length === 0)) {
      await markFailed(admin, analysisId, "video_url or frame_urls required");
      return new Response(JSON.stringify({ error: "video_url or frame_urls required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      await markFailed(admin, analysisId, "OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const images = (frame_urls && frame_urls.length > 0 ? frame_urls : [video_url]).map((url) => ({
      type: "image_url",
      image_url: { url },
    }));

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT + " JSON schema: " + JSON.stringify(ANALYSIS_SCHEMA) },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this breakawayroping run${athlete_name ? ` by ${athlete_name}` : ""}.`,
              },
              ...images,
            ],
          },
        ],
        max_tokens: 1400,
      }),
    });

    const aiData = await openaiRes.json();
    if (!openaiRes.ok) {
      await markFailed(admin, analysisId, aiData?.error?.message ?? "OpenAI error");
      return new Response(JSON.stringify({ error: aiData?.error?.message ?? "OpenAI error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      parsed = { summary: content };
    }

    if (admin && analysisId) {
      await admin
        .from("team_video_analyses")
        .update({ status: "complete", result_json: parsed })
        .eq("id", analysisId);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await markFailed(admin, analysisId, (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
