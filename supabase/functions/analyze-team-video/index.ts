import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// analyze-team-video — coach-mode batch analysis for breakaway roping.
//
// A coach uploads up to 15 runs (each already reduced to keyframes by the
// client). We grade every run against the breakaway judging criteria, tally the
// faults deterministically ("8 ropers breaking the barrier, 3 catching low"),
// then ask OpenAI to synthesise a short coaching report over the tally. Results
// are written to `team_video_batches` so the coach's device can poll the row.
//
// Backward compatible: if a single-video payload (analysis_id + video_url) is
// posted, it grades that one run and writes to the legacy team_video_analyses row.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = Deno.env.get("OPENAI_VIDEO_ANALYSIS_MODEL") ?? "gpt-4o";
const REPORT_MODEL = Deno.env.get("OPENAI_TEAM_REPORT_MODEL") ?? MODEL;

const CRITERIA_KEYS = [
  "barrier_work",
  "horse_positioning",
  "loop_delivery",
  "catch_zone",
  "rope_management",
  "string_release",
  "timing",
] as const;

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

const RUN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_breakaway_roping",
    "overall_score",
    "legal_catch",
    "barrier_broken",
    "summary",
    "criteria",
    "improvements",
  ],
  properties: {
    is_breakaway_roping: { type: "boolean" },
    overall_score: { type: "number" },
    legal_catch: { type: "boolean" },
    barrier_broken: { type: "boolean" },
    summary: { type: "string" },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: [...CRITERIA_KEYS],
      properties: Object.fromEntries(CRITERIA_KEYS.map((k) => [k, CRITERION])),
    },
    improvements: { type: "array", items: { type: "string" } },
  },
};

const RUN_SYSTEM_PROMPT =
  "You are an expert breakaway-roping coach and judge. Grade this athlete's run " +
  "from the time-ordered keyframes against breakaway criteria: barrier_work, " +
  "horse_positioning, loop_delivery, catch_zone (LEGAL catch is neck/head only), " +
  "rope_management, string_release (clean break off the horn), and timing. Score " +
  "each 0-100 with a rating and note. Respond ONLY with JSON matching the schema.";

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["team_summary", "common_faults", "priorities", "recommended_drills"],
  properties: {
    team_summary: { type: "string" },
    common_faults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fault", "count", "athletes", "coaching_note"],
        properties: {
          fault: { type: "string" },
          count: { type: "number" },
          athletes: { type: "array", items: { type: "string" } },
          coaching_note: { type: "string" },
        },
      },
    },
    priorities: { type: "array", items: { type: "string" } },
    recommended_drills: { type: "array", items: { type: "string" } },
  },
};

const REPORT_SYSTEM_PROMPT =
  "You are a head breakaway-roping coach writing a squad report. You are given a " +
  "deterministic tally of how many ropers share each fault and per-athlete grades. " +
  "Write a concise team_summary, restate the common_faults as clear coaching items " +
  "with the count and the athletes affected, list the top priorities to fix first, " +
  "and recommend group drills. Do NOT invent faults not present in the tally. " +
  "Respond ONLY with JSON matching the schema.";

function extractAssistantText(data: any): string {
  return data?.choices?.[0]?.message?.content ?? "";
}

function extractJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch (_e) { /* scan */ }
  const start = text.indexOf("{");
  if (start === -1) return { summary: text };
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch (_e) { return { summary: text }; }
      }
    }
  }
  return { summary: text };
}

async function gradeRun(
  openaiKey: string,
  frameUrls: string[],
  videoUrl: string | undefined,
  label: string,
): Promise<Record<string, unknown>> {
  const urls = frameUrls && frameUrls.length > 0 ? frameUrls : [videoUrl as string];
  const images = urls.filter(Boolean).map((url) => ({ type: "image_url", image_url: { url } }));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1400,
      response_format: {
        type: "json_schema",
        json_schema: { name: "breakaway_run", strict: true, schema: RUN_SCHEMA },
      },
      messages: [
        { role: "system", content: RUN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Grade breakaway run for athlete "${label}". Keyframes in time order.` },
            ...images,
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "OpenAI error");
  return extractJsonObject(extractAssistantText(data));
}

// Deterministic tally: which criteria came back poor/fair, and who for.
function tallyFaults(
  runs: { label: string; analysis: Record<string, any> }[],
): { fault: string; count: number; athletes: string[]; coaching_note: string }[] {
  const labelFor: Record<string, string> = {
    barrier_work: "Barrier work (breaking / late)",
    horse_positioning: "Horse positioning & rate",
    loop_delivery: "Loop delivery (swing/angle/timing)",
    catch_zone: "Catch zone (illegal / low catch)",
    rope_management: "Rope & slack management",
    string_release: "String release off the horn",
    timing: "Overall timing / rhythm",
  };
  const buckets: Record<string, string[]> = {};
  for (const key of CRITERIA_KEYS) buckets[key] = [];
  const barrierBreakers: string[] = [];
  const illegalCatches: string[] = [];

  for (const { label, analysis } of runs) {
    const criteria = (analysis?.criteria ?? {}) as Record<string, any>;
    for (const key of CRITERIA_KEYS) {
      const rating = criteria?.[key]?.rating;
      if (rating === "poor" || rating === "fair") buckets[key].push(label);
    }
    if (analysis?.barrier_broken === true) barrierBreakers.push(label);
    if (analysis?.legal_catch === false) illegalCatches.push(label);
  }

  const faults: { fault: string; count: number; athletes: string[]; coaching_note: string }[] = [];
  for (const key of CRITERIA_KEYS) {
    if (buckets[key].length > 0) {
      faults.push({
        fault: labelFor[key],
        count: buckets[key].length,
        athletes: buckets[key],
        coaching_note: "",
      });
    }
  }
  if (barrierBreakers.length > 0) {
    faults.push({
      fault: "Broke the barrier (10s penalty)",
      count: barrierBreakers.length,
      athletes: barrierBreakers,
      coaching_note: "",
    });
  }
  if (illegalCatches.length > 0) {
    faults.push({
      fault: "Illegal / no catch (not around the neck)",
      count: illegalCatches.length,
      athletes: illegalCatches,
      coaching_note: "",
    });
  }
  faults.sort((a, b) => b.count - a.count);
  return faults;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const body = await req.json().catch(() => ({} as any));

  // ---- Legacy single-video path (existing team-analysis screens) ----------
  if (body.analysis_id && !body.videos) {
    try {
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
      const analysis = await gradeRun(
        openaiKey,
        body.frame_urls ?? [],
        body.video_url,
        body.athlete_name ?? "athlete",
      );
      if (admin) {
        await admin.from("team_video_analyses")
          .update({ status: "complete", result_json: analysis })
          .eq("id", body.analysis_id);
      }
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      if (admin && body.analysis_id) {
        await admin.from("team_video_analyses")
          .update({ status: "failed", result_json: { error: (e as Error).message } })
          .eq("id", body.analysis_id);
      }
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ---- Batch aggregate path ------------------------------------------------
  const batchId: string | undefined = body.batch_id;
  const teamId: string | undefined = body.team_id;
  const coachId: string | undefined = body.coach_id;
  const videos: { label?: string; frame_urls?: string[]; video_url?: string }[] = body.videos ?? [];

  async function failBatch(message: string) {
    if (admin && batchId) {
      await admin.from("team_video_batches")
        .update({ status: "failed", aggregate_analysis: { error: message } })
        .eq("id", batchId);
    }
  }

  try {
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
    if (!videos.length) throw new Error("videos[] required for batch analysis");

    const graded: { label: string; analysis: Record<string, any> }[] = [];
    const videoIds: string[] = [];

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const label = v.label && v.label.trim() ? v.label : `Rider ${i + 1}`;
      let analysis: Record<string, any>;
      try {
        analysis = await gradeRun(openaiKey, v.frame_urls ?? [], v.video_url, label);
      } catch (e) {
        analysis = { error: (e as Error).message, criteria: {} };
      }
      graded.push({ label, analysis });

      // Store each run in video_analyses for the coach's records.
      if (admin && coachId) {
        const { data: inserted } = await admin.from("video_analyses").insert({
          user_id: coachId,
          event_type: body.event_type ?? "breakawayroping",
          video_url: v.video_url ?? null,
          frame_urls: v.frame_urls ?? [],
          status: analysis.error ? "failed" : "completed",
          overall_score: typeof analysis.overall_score === "number" ? analysis.overall_score : null,
          analysis_result: { ...analysis, athlete_label: label },
        }).select("id").single();
        if (inserted?.id) videoIds.push(inserted.id as string);
      }
    }

    // Deterministic fault tally (source of truth for counts).
    const commonFaults = tallyFaults(graded);

    // Ask OpenAI to synthesise the coaching narrative over the tally.
    let report: Record<string, unknown> = {
      team_summary: `${graded.length} runs analyzed. See common faults below.`,
      common_faults: commonFaults,
      priorities: commonFaults.slice(0, 3).map((f) => f.fault),
      recommended_drills: [],
    };

    try {
      const perAthlete = graded.map(({ label, analysis }) => ({
        athlete: label,
        overall_score: analysis?.overall_score ?? null,
        barrier_broken: analysis?.barrier_broken ?? null,
        legal_catch: analysis?.legal_catch ?? null,
        top_improvements: Array.isArray(analysis?.improvements) ? analysis.improvements.slice(0, 3) : [],
      }));
      const reportRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: REPORT_MODEL,
          temperature: 0.4,
          max_tokens: 1600,
          response_format: {
            type: "json_schema",
            json_schema: { name: "team_report", strict: true, schema: REPORT_SCHEMA },
          },
          messages: [
            { role: "system", content: REPORT_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                run_count: graded.length,
                deterministic_fault_tally: commonFaults,
                per_athlete: perAthlete,
              }),
            },
          ],
        }),
      });
      const reportData = await reportRes.json();
      if (reportRes.ok) {
        const synth = extractJsonObject(extractAssistantText(reportData));
        // Trust deterministic counts; keep the model's narrative + drills.
        report = {
          team_summary: synth.team_summary ?? report.team_summary,
          common_faults: Array.isArray(synth.common_faults) && synth.common_faults.length
            ? synth.common_faults
            : commonFaults,
          priorities: synth.priorities ?? report.priorities,
          recommended_drills: synth.recommended_drills ?? [],
        };
      }
    } catch (_e) {
      // Graceful fallback: keep the deterministic report already assembled.
    }

    const aggregate = {
      ...report,
      run_count: graded.length,
      per_athlete: graded.map(({ label, analysis }) => ({
        athlete: label,
        overall_score: analysis?.overall_score ?? null,
        legal_catch: analysis?.legal_catch ?? null,
        barrier_broken: analysis?.barrier_broken ?? null,
        summary: analysis?.summary ?? null,
      })),
    };

    if (admin && batchId) {
      await admin.from("team_video_batches").update({
        status: "completed",
        video_ids: videoIds,
        video_count: graded.length,
        aggregate_analysis: aggregate,
      }).eq("id", batchId);
    }

    return new Response(JSON.stringify(aggregate), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await failBatch((e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
