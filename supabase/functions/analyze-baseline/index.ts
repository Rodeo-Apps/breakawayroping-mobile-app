/**
 * analyze-baseline Edge Function
 *
 * Turns a walk-around capture — a standing horse and rider, head to hoof, from
 * several angles — into the measuring stick every later run analysis uses.
 *
 * WHAT IT PRODUCES
 *   * proportions, as ratios of a reference length (withers height for the
 *     horse, total height for the rider);
 *   * real-world inches, by multiplying those ratios by the horse height the
 *     owner declared in hands. Reading absolute size out of a photograph is
 *     unreliable; asking for the one number every owner already knows is not;
 *   * resting asymmetry, so a shoulder that always sits low is recorded as this
 *     rider's anatomy instead of being flagged as a fault thirty times a season;
 *   * a scale-invariant embedding per subject, for attributing unlabelled clips.
 *
 * WHAT IT DOES NOT PRODUCE
 * Any judgement about how the pair rides. A standing horse cannot tell you that.
 * The confidence fields are load bearing — a capture shot in poor light, or
 * missing the feet, must say so rather than quietly guessing.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate,
  corsHeaders,
  signAll,
  type SupabaseClient,
} from "../_shared/baselineAuth.ts";

declare const Deno: any;

const BASELINE_BUCKET = "baseline-captures";
const ANALYSIS_VERSION = 1;

/**
 * Hands notation is not decimal: "15.2 hands" means 15 hands and 2 inches, so
 * 62 inches — not 15.2 x 4. Getting this wrong would put a systematic error
 * into every measurement built on it.
 */
function handsToInches(hands: number | null): number | null {
  if (hands === null || !Number.isFinite(hands) || hands <= 0) return null;
  const whole = Math.floor(hands);
  const extraInches = Math.round((hands - whole) * 10);
  // Only .0 to .3 are meaningful; anything else is a typo, not a height.
  if (extraInches > 3) return null;
  return whole * 4 + extraInches;
}

interface AnalyzeBaselineRequest {
  baseline_id: string;
  /** Frame URLs or object paths, one per view, in capture order. */
  frame_urls?: string[];
  /** e.g. ["left", "left-front", "front", ...] — same length as frame_urls. */
  view_labels?: string[];
}

const NUM = { type: "number" } as const;
const NULLABLE_NUM = {
  anyOf: [{ type: "number" }, { type: "null" }],
} as const;

const BASELINE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_horse_and_rider",
    "capture_quality",
    "horse",
    "rider",
    "dyad",
    "resting_asymmetry",
    "confidence",
    "notes",
  ],
  properties: {
    is_horse_and_rider: { type: "boolean" },

    capture_quality: {
      type: "object",
      additionalProperties: false,
      required: [
        "full_body_visible",
        "hooves_visible",
        "head_visible",
        "usable_views",
        "lighting",
        "obstructions",
      ],
      properties: {
        full_body_visible: { type: "boolean" },
        hooves_visible: { type: "boolean" },
        head_visible: { type: "boolean" },
        usable_views: { type: "integer" },
        lighting: { type: "string", enum: ["good", "adequate", "poor"] },
        obstructions: { type: "array", items: { type: "string" } },
      },
    },

    // Every horse measurement is a ratio of withers height, which is 1.0 by
    // definition. The client multiplies by the declared height to get inches.
    horse: {
      type: "object",
      additionalProperties: false,
      required: [
        "body_length_ratio",
        "topline_length_ratio",
        "chest_depth_ratio",
        "neck_length_ratio",
        "cannon_length_ratio",
        "hip_height_ratio",
        "shoulder_angle_deg",
        "hip_angle_deg",
        "back_profile",
        "confidence",
      ],
      properties: {
        body_length_ratio: NULLABLE_NUM,
        topline_length_ratio: NULLABLE_NUM,
        chest_depth_ratio: NULLABLE_NUM,
        neck_length_ratio: NULLABLE_NUM,
        cannon_length_ratio: NULLABLE_NUM,
        hip_height_ratio: NULLABLE_NUM,
        shoulder_angle_deg: NULLABLE_NUM,
        hip_angle_deg: NULLABLE_NUM,
        back_profile: { type: "string", enum: ["short", "medium", "long", "unknown"] },
        confidence: NUM,
      },
    },

    // Rider ratios are of total standing height, 1.0 by definition.
    rider: {
      type: "object",
      additionalProperties: false,
      required: [
        "torso_ratio",
        "femur_ratio",
        "tibia_ratio",
        "arm_ratio",
        "shoulder_width_ratio",
        "confidence",
      ],
      properties: {
        torso_ratio: NULLABLE_NUM,
        femur_ratio: NULLABLE_NUM,
        tibia_ratio: NULLABLE_NUM,
        arm_ratio: NULLABLE_NUM,
        shoulder_width_ratio: NULLABLE_NUM,
        confidence: NUM,
      },
    },

    // How the pair sits together — the part neither body gives on its own.
    dyad: {
      type: "object",
      additionalProperties: false,
      required: [
        "seat_position_ratio",
        "stirrup_length_ratio",
        "heel_hip_shoulder_alignment_deg",
        "rider_lateral_offset_ratio",
        "confidence",
      ],
      properties: {
        /** 0 = over the withers, 1 = over the point of hip. */
        seat_position_ratio: NULLABLE_NUM,
        /** Stirrup drop as a fraction of the rider's leg length. */
        stirrup_length_ratio: NULLABLE_NUM,
        /** 0 is a plumb line through heel, hip and shoulder. */
        heel_hip_shoulder_alignment_deg: NULLABLE_NUM,
        /** Positive = seated right of the horse's midline. */
        rider_lateral_offset_ratio: NULLABLE_NUM,
        confidence: NUM,
      },
    },

    // The whole point of a baseline: what is normal for this pair at rest.
    resting_asymmetry: {
      type: "object",
      additionalProperties: false,
      required: [
        "rider_shoulder_tilt_deg",
        "rider_hip_tilt_deg",
        "rider_head_offset_ratio",
        "horse_stance_even",
        "notes",
        "confidence",
      ],
      properties: {
        rider_shoulder_tilt_deg: NULLABLE_NUM,
        rider_hip_tilt_deg: NULLABLE_NUM,
        rider_head_offset_ratio: NULLABLE_NUM,
        horse_stance_even: { type: "boolean" },
        notes: { type: "string" },
        confidence: NUM,
      },
    },

    confidence: NUM,
    notes: { type: "string" },
  },
};

type ResponsesOutputBlock = { type?: string; text?: string; refusal?: string };
type ResponsesOutputItem = {
  type?: string;
  role?: string;
  content?: ResponsesOutputBlock[];
};

function extractAssistantText(data: Record<string, unknown>): string {
  const topError = data.error as { message?: string } | undefined;
  if (topError?.message) throw new Error(`OpenAI response error: ${topError.message}`);
  if (data.status !== "completed") {
    const incomplete = data.incomplete_details as { reason?: string } | undefined;
    const reason = incomplete?.reason ? ` reason=${incomplete.reason}` : "";
    throw new Error(`OpenAI response not completed (status=${String(data.status)}${reason})`);
  }
  const output = data.output as ResponsesOutputItem[] | undefined;
  if (!Array.isArray(output)) throw new Error("OpenAI response missing output array");

  const parts: string[] = [];
  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    if (item.role != null && item.role !== "assistant") continue;
    for (const block of item.content) {
      if (block.type === "output_text" && typeof block.text === "string") parts.push(block.text);
      if (block.refusal) throw new Error(`OpenAI content refusal: ${block.refusal.slice(0, 300)}`);
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
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return trimmed.slice(start, i + 1); }
  }
  return null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Scale-invariant proportion vector for one subject.
 *
 * Ratios only, in a fixed order, so two captures of the same animal land close
 * together regardless of how far away the camera was. Missing values become 0
 * rather than dropping a dimension, which would shift every later element and
 * make two vectors incomparable.
 */
function buildEmbedding(source: Record<string, unknown>, keys: string[]): number[] | null {
  const vector = keys.map((k) => num(source?.[k]) ?? 0);
  return vector.some((v) => v !== 0) ? vector : null;
}

const HORSE_EMBEDDING_KEYS = [
  "body_length_ratio",
  "topline_length_ratio",
  "chest_depth_ratio",
  "neck_length_ratio",
  "cannon_length_ratio",
  "hip_height_ratio",
  "shoulder_angle_deg",
  "hip_angle_deg",
];

const RIDER_EMBEDDING_KEYS = [
  "torso_ratio",
  "femur_ratio",
  "tibia_ratio",
  "arm_ratio",
  "shoulder_width_ratio",
];

/**
 * Overall quality, used to decide whether to trust the capture at all.
 * A capture missing the hooves cannot establish withers height, so it is capped
 * hard rather than nudged.
 */
function scoreQuality(q: Record<string, unknown>, viewCount: number): number {
  let score = 1;
  if (q.full_body_visible !== true) score -= 0.35;
  if (q.hooves_visible !== true) score -= 0.3;
  if (q.head_visible !== true) score -= 0.1;
  if (q.lighting === "poor") score -= 0.25;
  else if (q.lighting === "adequate") score -= 0.08;

  const usable = num(q.usable_views) ?? viewCount;
  if (usable < 2) score -= 0.3;
  else if (usable < 4) score -= 0.12;

  const obstructions = Array.isArray(q.obstructions) ? q.obstructions.length : 0;
  score -= Math.min(obstructions * 0.05, 0.2);

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

/** Ratios × the declared withers height. Only meaningful with a real height. */
function toInches(
  horse: Record<string, unknown>,
  withersInches: number | null,
): Record<string, number> | null {
  if (!withersInches) return null;
  const out: Record<string, number> = { withers_height: withersInches };
  for (const key of [
    "body_length_ratio",
    "topline_length_ratio",
    "chest_depth_ratio",
    "neck_length_ratio",
    "cannon_length_ratio",
    "hip_height_ratio",
  ]) {
    const ratio = num(horse?.[key]);
    if (ratio !== null) {
      out[key.replace("_ratio", "_inches")] = Number((ratio * withersInches).toFixed(2));
    }
  }
  return out;
}

async function markFailed(
  service: SupabaseClient,
  baselineId: string | undefined,
  reason: string,
): Promise<void> {
  if (!baselineId) return;
  try {
    await service
      .from("horse_rider_baselines")
      .update({ status: "failed", failure_reason: reason.slice(0, 500) })
      .eq("id", baselineId);
  } catch (e) {
    console.error("Failed to mark baseline failed:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let baselineId: string | undefined;
  let serviceRef: SupabaseClient | undefined;

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY environment variable is not set");

    const { service, asUser } = await authenticate(req);
    serviceRef = service;

    const body: AnalyzeBaselineRequest = await req.json();
    baselineId = body.baseline_id;
    if (!baselineId) throw new Error("baseline_id is required");

    // Read through the caller's own client: RLS is the ownership check, so a
    // missing row and someone else's row are indistinguishable from here.
    const { data: baseline, error: baselineError } = await asUser
      .from("horse_rider_baselines")
      .select(
        "id, user_id, horse_id, horse_name, horse_height_hands, rider_height_inches, frame_paths, view_labels",
      )
      .eq("id", baselineId)
      .single();
    if (baselineError || !baseline) {
      throw new Error("Baseline not found, or it does not belong to you");
    }

    const rawFrames =
      body.frame_urls && body.frame_urls.length > 0
        ? body.frame_urls
        : ((baseline.frame_paths as string[] | null) ?? []);
    if (rawFrames.length === 0) {
      throw new Error("No capture frames provided for this baseline");
    }

    const viewLabels =
      body.view_labels && body.view_labels.length === rawFrames.length
        ? body.view_labels
        : ((baseline.view_labels as string[] | null) ?? []);

    await service
      .from("horse_rider_baselines")
      .update({ status: "processing", failure_reason: null })
      .eq("id", baselineId);

    const imageUrls = await signAll(service, rawFrames, BASELINE_BUCKET);
    if (imageUrls.length === 0) {
      throw new Error("Could not access the capture frames");
    }

    const viewLines = imageUrls
      .map((_, i) => `- Image ${i + 1}: ${viewLabels[i] ?? "unlabelled view"}`)
      .join("\n");

    const hands = num(baseline.horse_height_hands);
    const withersInches = handsToInches(hands);

    const prompt = `You are measuring a STANDING horse and rider for a coaching baseline. This is a calibration capture, not a performance review — say nothing about how the pair rides.

You have ${imageUrls.length} still frames of the same horse and rider taken from different angles in one walk-around:
${viewLines}

${withersInches
  ? `The owner states this horse is ${hands} hands (${withersInches} inches at the withers). Use that only as context; still report every measurement as a RATIO, and we will convert.`
  : "No usable horse height was declared, so report ratios only."}

Report every horse measurement as a ratio of WITHERS HEIGHT (withers height is 1.0 by definition).
Report every rider measurement as a ratio of the rider's TOTAL STANDING HEIGHT (1.0 by definition).

Definitions, so the numbers mean the same thing every time:
- body_length_ratio: point of shoulder to point of buttock
- topline_length_ratio: withers to point of croup
- chest_depth_ratio: withers straight down to the girth line
- neck_length_ratio: poll to withers
- cannon_length_ratio: knee to fetlock, front leg
- hip_height_ratio: point of croup to the ground
- shoulder_angle_deg: angle of the scapula from horizontal
- hip_angle_deg: angle of the pelvis from horizontal
- seat_position_ratio: where the rider sits along the back, 0 at the withers and 1 at the point of hip
- stirrup_length_ratio: stirrup drop as a fraction of the rider's leg length
- heel_hip_shoulder_alignment_deg: departure from a vertical line through heel, hip and shoulder; 0 is plumb

resting_asymmetry is the most important section. A rider whose left shoulder always sits lower has anatomy, not a fault, and recording it here is what stops later analyses flagging it every single run. Report the tilts you can actually see and say in notes whether they look structural or like a one-off stance.

BE HONEST ABOUT WHAT YOU CANNOT SEE. If the hooves are cut off, set hooves_visible false — withers height cannot be established without the ground line, and every ratio built on it is then guesswork. If a measurement is not visible in any frame, return null for it rather than a plausible number. Set each confidence between 0 and 1, and keep them low when you are inferring rather than measuring. A baseline that admits it is poor is useful; one that quietly guesses corrupts every run measured against it.

If these frames are not a horse and rider, set is_horse_and_rider false, use nulls throughout, and explain in notes.

Output must match the JSON schema only (no markdown fences).`;

    const inputContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "high" | "low" | "auto" }
    > = [{ type: "input_text", text: prompt }];
    for (const url of imageUrls) {
      // Geometry from a still needs the detail; this runs once per pair, not per run.
      inputContent.push({ type: "input_image", image_url: url, detail: "high" });
    }

    const model = Deno.env.get("OPENAI_BASELINE_MODEL")?.trim()
      || Deno.env.get("OPENAI_VIDEO_ANALYSIS_MODEL")?.trim()
      || "gpt-5.4";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [{ type: "message", role: "user", content: inputContent }],
        max_output_tokens: 6144,
        temperature: 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "horse_rider_baseline",
            strict: true,
            schema: BASELINE_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API request failed: ${response.status} - ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const text = extractAssistantText(data);
    if (!text) throw new Error("No analysis returned from OpenAI");

    const trimmed = text.trim();
    let jsonStr: string | null = null;
    try {
      JSON.parse(trimmed);
      jsonStr = trimmed;
    } catch {
      jsonStr = extractJsonObject(trimmed);
    }
    if (!jsonStr) throw new Error("OpenAI did not return valid JSON: " + text.slice(0, 200));

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (parsed.is_horse_and_rider === false) {
      await markFailed(
        service,
        baselineId,
        typeof parsed.notes === "string"
          ? parsed.notes
          : "These frames do not show a horse and rider.",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "These frames do not show a horse and rider. Re-shoot the walk-around.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const horse = (parsed.horse ?? {}) as Record<string, unknown>;
    const rider = (parsed.rider ?? {}) as Record<string, unknown>;
    const quality = (parsed.capture_quality ?? {}) as Record<string, unknown>;

    const qualityScore = scoreQuality(quality, imageUrls.length);
    const modelConfidence = num(parsed.confidence) ?? 0.5;
    // A confident model reading a bad capture is still a bad baseline, so the
    // stored confidence can never exceed what the capture itself supports.
    const confidence = Number(Math.min(modelConfidence, qualityScore).toFixed(3));

    // Without the ground line there is no withers height, so nothing converts
    // to inches no matter what the owner declared.
    const scaleUsable = quality.hooves_visible === true && quality.full_body_visible === true;
    const scaleReference = scaleUsable ? withersInches : null;

    const measurements = {
      ...parsed,
      derived: {
        horse_inches: toInches(horse, scaleReference),
        rider_height_inches: num(baseline.rider_height_inches),
        scale_reference_inches: scaleReference,
        scale_available: scaleReference !== null,
        scale_unavailable_reason: scaleReference
          ? null
          : !withersInches
            ? "No usable horse height was entered, so measurements are proportional only. Hands are written like 15.2, meaning 15 hands and 2 inches."
            : "The hooves or full body were not visible, so the ground line could not be established.",
      },
      analysis_version: ANALYSIS_VERSION,
    };

    const { error: updateError } = await service
      .from("horse_rider_baselines")
      .update({
        status: "completed",
        measurements,
        horse_embedding: buildEmbedding(horse, HORSE_EMBEDDING_KEYS),
        rider_embedding: buildEmbedding(rider, RIDER_EMBEDDING_KEYS),
        scale_reference_inches: scaleReference,
        quality_score: qualityScore,
        quality_notes: quality,
        confidence,
        analysis_version: ANALYSIS_VERSION,
        // Condition, tack and (for juniors) the rider all change over a season.
        recommended_recapture_at: new Date(
          Date.now() + 180 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        failure_reason: null,
      })
      .eq("id", baselineId);
    if (updateError) throw new Error(`Failed to store baseline: ${updateError.message}`);

    // Only now retire the previous one — a failed capture must not leave the
    // rider with no usable baseline at all.
    await service.rpc("supersede_previous_baselines", { p_baseline_id: baselineId });

    return new Response(
      JSON.stringify({
        success: true,
        baseline_id: baselineId,
        quality_score: qualityScore,
        confidence,
        scale_available: scaleReference !== null,
        measurements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("analyze-baseline error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (serviceRef) await markFailed(serviceRef, baselineId, message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
