/**
 * generate-team-report Edge Function
 *
 * Aggregates every run_analysis_results row for a batch into a single team
 * report: common mistakes across the team, a rider-by-rider breakdown, the top
 * issues, and targeted drill suggestions based on observed patterns.
 *
 * Flow:
 *   1. Auth caller + verify they are a coach/staff of the batch's team.
 *   2. Load batch, team_videos and their run_analysis_results.
 *   3. Deterministically tally mistakes per category + per rider (robust baseline).
 *   4. Ask OpenAI to synthesize coach-facing drills/insights from the tally.
 *      (If OpenAI fails, fall back to the deterministic aggregation only.)
 *   5. Upsert team_analysis_reports.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateTeamReportRequest {
  batch_id: string;
}

interface Mistake {
  category?: string;
  description?: string;
  severity?: string;
}

const REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "common_mistakes", "top_issues", "suggested_drills"],
  properties: {
    summary: { type: "string" },
    common_mistakes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "description", "affected_riders", "frequency"],
        properties: {
          category: { type: "string" },
          description: { type: "string" },
          affected_riders: { type: "number" },
          frequency: { type: "number" },
        },
      },
    },
    top_issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "priority"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    suggested_drills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "targets", "description"],
        properties: {
          name: { type: "string" },
          targets: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
};

type ResponsesOutputBlock = { type?: string; text?: string; refusal?: string };
type ResponsesOutputItem = { type?: string; role?: string; content?: ResponsesOutputBlock[] };

function extractAssistantText(data: Record<string, unknown>): string {
  const status = data.status;
  if (status !== "completed") return "";
  const output = data.output as ResponsesOutputItem[] | undefined;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }
  return parts.join("");
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const body: GenerateTeamReportRequest = await req.json();
    const batchId = body.batch_id;
    if (!batchId) throw new Error("batch_id is required");

    // ---- Load batch + verify coach authorization ----
    const { data: batch, error: batchError } = await supabase
      .from("team_video_batches")
      .select("id, team_id, batch_name")
      .eq("id", batchId)
      .single();
    if (batchError || !batch) throw new Error("Batch not found");

    const { data: isCoach, error: coachError } = await supabase.rpc("is_team_coach", {
      target_team_id: batch.team_id,
    });
    if (coachError) console.error("is_team_coach RPC error:", coachError);
    if (!isCoach) {
      throw new Error("Unauthorized: only team coaches can generate team reports");
    }

    // ---- Load videos + analysis results for the batch ----
    const { data: videos, error: videosError } = await supabase
      .from("team_videos")
      .select("id, rider_id, horse_name, event_type, drill_name")
      .eq("batch_id", batchId);
    if (videosError) throw new Error(`Failed to load videos: ${videosError.message}`);
    if (!videos || videos.length === 0) {
      throw new Error("No videos found in this batch");
    }

    const videoIds = videos.map((v: { id: string }) => v.id);
    const { data: results, error: resultsError } = await supabase
      .from("run_analysis_results")
      .select("video_id, analysis_data, mistakes_identified, confidence_score")
      .in("video_id", videoIds);
    if (resultsError) {
      throw new Error(`Failed to load analysis results: ${resultsError.message}`);
    }
    if (!results || results.length === 0) {
      throw new Error("No completed analyses available to aggregate yet");
    }

    // ---- Resolve rider display names ----
    const riderIds = Array.from(
      new Set(videos.map((v: { rider_id: string | null }) => v.rider_id).filter(Boolean)),
    ) as string[];
    const riderNames: Record<string, string> = {};
    if (riderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", riderIds);
      for (const p of profiles ?? []) {
        riderNames[(p as { id: string }).id] = (p as { name?: string }).name || "Rider";
      }
    }

    // ---- Deterministic aggregation (robust baseline) ----
    const resultByVideo = new Map<string, any>();
    for (const r of results) resultByVideo.set((r as { video_id: string }).video_id, r);

    const categoryTally: Record<
      string,
      { count: number; riders: Set<string>; samples: string[] }
    > = {};
    const riderBreakdown: Record<
      string,
      {
        rider_id: string | null;
        rider_name: string;
        videos: number;
        avg_score: number;
        mistakes: { category: string; description: string; severity: string }[];
      }
    > = {};

    let scoreSum = 0;
    let scoreCount = 0;

    for (const v of videos) {
      const r = resultByVideo.get((v as { id: string }).id);
      if (!r) continue;
      const data = (r.analysis_data ?? {}) as Record<string, unknown>;
      const score = typeof data.overall_score === "number" ? data.overall_score : 0;
      scoreSum += score;
      scoreCount += 1;

      const riderKey = (v as { rider_id: string | null }).rider_id ?? "unassigned";
      const riderName =
        (v as { rider_id: string | null }).rider_id
          ? riderNames[(v as { rider_id: string }).rider_id] || "Rider"
          : "Unassigned";

      if (!riderBreakdown[riderKey]) {
        riderBreakdown[riderKey] = {
          rider_id: (v as { rider_id: string | null }).rider_id,
          rider_name: riderName,
          videos: 0,
          avg_score: 0,
          mistakes: [],
        };
      }
      const rb = riderBreakdown[riderKey];
      rb.videos += 1;
      rb.avg_score += score;

      const mistakes = (r.mistakes_identified ?? []) as Mistake[];
      for (const m of mistakes) {
        const category = (m.category || "other").toLowerCase().trim();
        const description = m.description || category;
        const severity = m.severity || "medium";
        if (!categoryTally[category]) {
          categoryTally[category] = { count: 0, riders: new Set(), samples: [] };
        }
        categoryTally[category].count += 1;
        categoryTally[category].riders.add(riderKey);
        if (categoryTally[category].samples.length < 3) {
          categoryTally[category].samples.push(description);
        }
        rb.mistakes.push({ category, description, severity });
      }
    }

    for (const key of Object.keys(riderBreakdown)) {
      const rb = riderBreakdown[key];
      rb.avg_score = rb.videos > 0 ? Math.round(rb.avg_score / rb.videos) : 0;
    }

    const commonMistakes = Object.entries(categoryTally)
      .map(([category, t]) => ({
        category,
        description: t.samples[0] || category,
        affected_riders: t.riders.size,
        frequency: t.count,
      }))
      .sort((a, b) => b.frequency - a.frequency);

    const teamAvgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;

    // ---- OpenAI synthesis (drills + prioritized issues). Falls back gracefully. ----
    let aiReport:
      | {
          summary?: string;
          common_mistakes?: unknown[];
          top_issues?: unknown[];
          suggested_drills?: unknown[];
        }
      | null = null;

    if (openaiApiKey && commonMistakes.length > 0) {
      try {
        const aggregateForPrompt = {
          team_videos: videos.length,
          analyzed_runs: results.length,
          team_avg_score: teamAvgScore,
          common_mistakes: commonMistakes,
          rider_breakdown: Object.values(riderBreakdown).map((rb) => ({
            rider: rb.rider_name,
            videos: rb.videos,
            avg_score: rb.avg_score,
            mistake_categories: rb.mistakes.map((m) => m.category),
          })),
        };

        const prompt = `You are a head breakaway roping coach reviewing a team's batch of runs.
Here is the aggregated analysis across all riders (JSON):
${JSON.stringify(aggregateForPrompt, null, 2)}

Produce a concise team report:
- summary: 2-3 sentences on the team's overall performance and the biggest theme to work on.
- common_mistakes: the recurring issues across riders (use the provided categories/frequencies; keep affected_riders and frequency consistent with the data).
- top_issues: the 3-5 highest-priority things to fix, each with a priority (low/medium/high).
- suggested_drills: 3-6 specific breakaway roping drills that target the common mistakes. For each, name it, list what it targets, and describe how to run it.

Output must match the JSON schema only (no markdown fences).`;

        const openaiModel =
          Deno.env.get("OPENAI_TEAM_REPORT_MODEL")?.trim() ||
          Deno.env.get("OPENAI_VIDEO_ANALYSIS_MODEL")?.trim() ||
          "gpt-5.4";

        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            input: [
              {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: prompt }],
              },
            ],
            max_output_tokens: 4096,
            temperature: 0.4,
            text: {
              format: {
                type: "json_schema",
                name: "team_analysis_report",
                strict: true,
                schema: REPORT_SCHEMA,
              },
            },
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as Record<string, unknown>;
          const text = extractAssistantText(data);
          const jsonStr = (() => {
            try {
              JSON.parse(text.trim());
              return text.trim();
            } catch {
              return extractJsonObject(text);
            }
          })();
          if (jsonStr) aiReport = JSON.parse(jsonStr);
        } else {
          console.error("OpenAI report synthesis failed:", resp.status, await resp.text());
        }
      } catch (aiErr) {
        console.error("OpenAI report synthesis error (continuing with baseline):", aiErr);
      }
    }

    // ---- Compose final report payload ----
    const topIssues =
      aiReport?.top_issues ??
      commonMistakes.slice(0, 5).map((m) => ({
        title: m.category,
        detail: `${m.description} (seen in ${m.affected_riders} rider(s), ${m.frequency} time(s))`,
        priority: m.frequency >= 3 ? "high" : m.frequency === 2 ? "medium" : "low",
      }));

    const suggestedDrills = aiReport?.suggested_drills ?? [];

    const reportPayload = {
      batch_id: batchId,
      team_id: batch.team_id,
      common_mistakes: aiReport?.common_mistakes ?? commonMistakes,
      rider_breakdown: {
        team_avg_score: teamAvgScore,
        riders: Object.values(riderBreakdown),
        summary: aiReport?.summary ?? "",
      },
      suggested_drills: suggestedDrills,
      top_issues: topIssues,
      generated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("team_analysis_reports")
      .upsert(reportPayload, { onConflict: "batch_id" });
    if (upsertError) {
      throw new Error(`Failed to store team report: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, batch_id: batchId, report: reportPayload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-team-report error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
