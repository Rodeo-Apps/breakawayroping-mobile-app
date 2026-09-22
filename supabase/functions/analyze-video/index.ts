import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// analyze-video — individual breakaway-roping run analysis.
//
// OpenAI vision reads images, not raw video, so the client extracts keyframes
// (expo-video-thumbnails), uploads them to the `video-frames` bucket, and passes
// `frame_urls` here. We score the run against breakaway-roping judging criteria
// using OpenAI structured outputs, then persist the result to `video_analyses`.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = Deno.env.get("OPENAI_VIDEO_ANALYSIS_MODEL") ?? "gpt-4o";

interface AnalyzeRequest {
  video_url?: string;
  frame_urls?: string[];
  frame_times_ms?: number[];
  user_id: string;
  event_type?: string;
  analysis_id?: string;
}

// A single graded criterion: qualitative rating + 0-100 score + coach note.
const CRITERION = {
  type: "object",
  additionalProperties: false,
  required: ["rating", "score", "notes"],
  properties: {
    rating: { type: "string", enum: ["excellent", "good", "fair", "poor", "not_visible"] },
    score: { type: "number" },
    notes: { type: "string" },
  },
};

// Breakaway-roping judging schema. Every criterion the sport is judged on is a
// required, named field so results tally identically across athletes.
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_breakaway_roping",
    "confidence",
    "overall_score",
    "legal_catch",
    "barrier_broken",
    "estimated_time_seconds",
    "summary",
    "criteria",
    "strengths",
    "improvements",
    "drills",
  ],
  properties: {
    is_breakaway_roping: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    overall_score: { type: "number", description: "0-100 overall run quality" },
    legal_catch: {
      type: "boolean",
      description: "true only if the loop caught cleanly around the neck/head (the only legal catch)",
    },
    barrier_broken: {
      type: "boolean",
      description: "true if the roper broke the barrier (10s penalty in competition)",
    },
    estimated_time_seconds: {
      type: "number",
      description: "best estimate of the run time from barrier to string release; -1 if not determinable",
    },
    summary: { type: "string" },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: [
        "barrier_work",
        "horse_positioning",
        "loop_delivery",
        "catch_zone",
        "rope_management",
        "string_release",
        "timing",
      ],
      properties: {
        barrier_work: CRITERION,       // scoreline / did they break the barrier
        horse_positioning: CRITERION,  // rate, position off the corner, speed to the calf
        loop_delivery: CRITERION,      // swing, angle, delivery timing
        catch_zone: CRITERION,         // neck-only legal catch
        rope_management: CRITERION,    // slack handling, coils, no wraps
        string_release: CRITERION,     // clean break of the string off the saddle horn
        timing: CRITERION,             // overall rhythm / official time efficiency
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    drills: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT =
  "You are an expert breakaway-roping coach and certified judge. You are given " +
  "sequential keyframes (in time order) of a single athlete's breakaway run filmed " +
  "from the stands. Judge the run against breakaway-roping rules and score each of " +
  "these criteria out of 100 with a rating and a specific coaching note: " +
  "barrier_work (did the roper honor or break the barrier), horse_positioning " +
  "(rate off the corner, position, speed to the calf), loop_delivery (swing, angle, " +
  "delivery timing), catch_zone (a LEGAL catch is around the neck/head ONLY — a leg, " +
  "belly, or body catch is illegal), rope_management (slack handling and coils), " +
  "string_release (the string must break cleanly off the saddle horn to stop the " +
  "clock), and timing (overall rhythm and time efficiency). Set legal_catch true " +
  "only for a clean neck catch, barrier_broken true if the barrier was broken, and " +
  "estimate the run time. Give concrete strengths, improvements, and practice-pen " +
  "drills. If the clip is not breakaway roping, set is_breakaway_roping=false and " +
  "score conservatively. Respond ONLY with JSON matching the provided schema.";

// Pull the assistant's text out of a chat/completions response.
function extractAssistantText(data: any): string {
  return data?.choices?.[0]?.message?.content ?? "";
}

// Tolerant JSON extraction: parse directly, else scan for the first balanced object.
function extractJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch (_e) {
    // fall through to brace scanning
  }
  const start = text.indexOf("{");
  if (start === -1) return { summary: text };
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch (_e) {
          return { summary: text };
        }
      }
    }
  }
  return { summary: text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    const body = (await req.json()) as AnalyzeRequest;
    const { video_url, frame_urls, user_id } = body;

    if ((!frame_urls || frame_urls.length === 0) && !video_url) {
      return new Response(
        JSON.stringify({ error: "frame_urls or video_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const urls = frame_urls && frame_urls.length > 0 ? frame_urls : [video_url as string];
    const images = urls.map((url) => ({ type: "image_url", image_url: { url } }));

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 2048,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "breakaway_run_analysis",
            strict: true,
            schema: ANALYSIS_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Analyze this breakaway-roping run. ${images.length} keyframes are provided in time order.`,
              },
              ...images,
            ],
          },
        ],
      }),
    });

    const aiData = await openaiRes.json();
    if (!openaiRes.ok) {
      return new Response(
        JSON.stringify({ error: aiData?.error?.message ?? "OpenAI error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = extractJsonObject(extractAssistantText(aiData));
    const overallScore =
      typeof parsed.overall_score === "number" ? parsed.overall_score : null;

    // Persist to video_analyses (best-effort).
    if (admin && user_id) {
      const row = {
        user_id,
        event_type: body.event_type ?? "breakawayroping",
        video_url: video_url ?? null,
        frame_urls: frame_urls ?? [],
        status: "completed",
        overall_score: overallScore,
        analysis_result: parsed,
      };
      if (body.analysis_id) {
        await admin.from("video_analyses").update(row).eq("id", body.analysis_id);
      } else {
        await admin.from("video_analyses").insert(row);
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
