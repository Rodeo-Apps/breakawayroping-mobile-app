import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// analyze-video edge function for breakaway roping.
//
// OpenAI's Vision API accepts images, not raw video. The client should pass
// `frame_urls` (extracted keyframes). If only `video_url` is supplied we still
// attempt analysis using it as a single image reference.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  video_url: string;
  frame_urls?: string[];
  user_id: string;
  event_type?: string;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_breakawayroping",
    "confidence",
    "overall_score",
    "summary",
    "phases",
    "strengths",
    "improvements",
    "drills",
  ],
  properties: {
    is_breakawayroping: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    overall_score: { type: "number" },
    summary: { type: "string" },
    phases: {
      type: "object",
      additionalProperties: false,
      required: ["start", "swing", "delivery", "horse_work"],
      properties: {
          start: { type: "string" },
          swing: { type: "string" },
          delivery: { type: "string" },
          horse_work: { type: "string" },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    drills: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT =
  "You are an expert breakaway roping coach. Analyze the athlete's run from the supplied frames. " +
  "Score the run out of 100, summarize what happened, break down each phase, and give concrete, " +
  "actionable strengths, improvements, and drills. Respond ONLY with JSON matching the schema.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as AnalyzeRequest;
    const { video_url, frame_urls, user_id } = body;
    if (!video_url && (!frame_urls || frame_urls.length === 0)) {
      return new Response(JSON.stringify({ error: "video_url or frame_urls required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
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
              { type: "text", text: "Analyze this breakaway roping run." },
              ...images,
            ],
          },
        ],
        max_tokens: 1200,
      }),
    });

    const aiData = await openaiRes.json();
    if (!openaiRes.ok) {
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

    // Persist the result (best-effort) using the service role key.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey && user_id) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("video_analysis_results").insert({
        user_id,
        event_type: body.event_type ?? "breakawayroping",
        video_url,
        overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : null,
        summary: typeof parsed.summary === "string" ? parsed.summary : null,
        strengths: parsed.strengths ?? null,
        improvements: parsed.improvements ?? null,
        drills: parsed.drills ?? null,
        raw_response: parsed,
      });
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
