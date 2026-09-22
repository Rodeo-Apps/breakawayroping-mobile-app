import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, EmptyState, Loader, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";
import {
  analyzeBaseline,
  deleteBaseline,
  getBaseline,
  isBaselineStale,
} from "@/services/supabase/baseline";
import type { HorseRiderBaseline } from "@/services/supabase/baseline";

/**
 * What the baseline actually measured, and — just as importantly — how much of
 * it to believe. A capture that could not see the hooves produces no inches,
 * and the screen says so plainly rather than showing confident-looking numbers
 * built on a guess.
 */

const Row = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-center justify-between py-2">
    <Typography.Body2 className="text-secondaryText flex-1">{label}</Typography.Body2>
    <Typography.Body1 className="text-primaryText">{value}</Typography.Body1>
  </View>
);

const inches = (v: number | null | undefined): string =>
  typeof v === "number" ? `${v.toFixed(1)}"` : "—";

const degrees = (v: number | null | undefined): string =>
  typeof v === "number" ? `${v.toFixed(1)}°` : "—";

const BaselineDetailScreen = () => {
  const params = useLocalSearchParams<{ baselineId?: string | string[] }>();
  const baselineId =
    typeof params.baselineId === "string"
      ? params.baselineId
      : Array.isArray(params.baselineId)
        ? params.baselineId[0]
        : undefined;

  const primary = useCSSVariable("--color-primary") as string;
  const [baseline, setBaseline] = useState<HorseRiderBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);

  const load = useCallback(async () => {
    if (!baselineId) {
      setLoading(false);
      return;
    }
    try {
      setBaseline(await getBaseline(baselineId));
    } catch {
      setBaseline(null);
    } finally {
      setLoading(false);
    }
  }, [baselineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rerun = async () => {
    if (!baselineId) return;
    setRerunning(true);
    try {
      await analyzeBaseline(baselineId);
      await load();
    } catch (e: any) {
      showAlert(e?.message ?? "Could not re-measure this capture", "error");
    } finally {
      setRerunning(false);
    }
  };

  const remove = async () => {
    if (!baselineId) return;
    try {
      await deleteBaseline(baselineId);
      router.back();
    } catch (e: any) {
      showAlert(e?.message ?? "Could not delete this baseline", "error");
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <Loader message="Loading baseline..." />
      </ScreenWrapper>
    );
  }

  if (!baseline) {
    return (
      <ScreenWrapper>
        <EmptyState
          icon={<Ionicons name="warning-outline" size={40} color="#ef4444" />}
          message="That baseline could not be found."
        />
      </ScreenWrapper>
    );
  }

  const m = baseline.measurements ?? {};
  const derived = m.derived ?? {};
  const horseInches = derived.horse_inches ?? null;
  const asym = m.resting_asymmetry ?? {};
  const dyad = m.dyad ?? {};
  const quality = m.capture_quality ?? {};
  const confidencePct =
    typeof baseline.confidence === "number" ? Math.round(baseline.confidence * 100) : null;

  return (
    <ScreenWrapper>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
        <Typography.Heading3 className="text-primaryText" textProps={{ numberOfLines: 1 }}>
          {baseline.horse_name || "Baseline"}
        </Typography.Heading3>
        <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete baseline">
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {baseline.status === "failed" ? (
          <View className="bg-card rounded-3xl p-4 mb-4">
            <Typography.SubHeading2 className="text-primaryText mb-1">
              This capture did not work
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText mb-3">
              {baseline.failure_reason || "Something went wrong measuring this capture."}
            </Typography.Body2>
            <Button
              title={rerunning ? "Trying again..." : "Try measuring again"}
              loading={rerunning}
              onPress={rerun}
            />
          </View>
        ) : null}

        {/* How much to trust it */}
        <View className="bg-card rounded-3xl p-4 mb-4">
          <View className="flex-row items-center gap-x-3 mb-2">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{ backgroundColor: `${primary}22` }}
            >
              <Ionicons name="analytics-outline" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                Capture quality
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                {confidencePct !== null ? `${confidencePct}% confidence` : "Not measured yet"}
              </Typography.Caption1>
            </View>
          </View>
          <Row label="Whole horse in frame" value={quality.full_body_visible ? "Yes" : "No"} />
          <Row label="Hooves visible" value={quality.hooves_visible ? "Yes" : "No"} />
          <Row label="Usable views" value={String(quality.usable_views ?? "—")} />
          <Row label="Lighting" value={quality.lighting ?? "—"} />
          {!derived.scale_available ? (
            <Typography.Body2 className="text-secondaryText mt-2">
              {derived.scale_unavailable_reason ??
                "Measurements are proportional only — no inches from this capture."}
            </Typography.Body2>
          ) : null}
        </View>

        {/* Horse, in inches when we can */}
        {horseInches ? (
          <View className="bg-card rounded-3xl p-4 mb-4">
            <Typography.SubHeading1 className="text-primaryText mb-1">
              Horse
            </Typography.SubHeading1>
            <Row label="Withers height" value={inches(horseInches.withers_height)} />
            <Row label="Body length" value={inches(horseInches.body_length_inches)} />
            <Row label="Topline" value={inches(horseInches.topline_length_inches)} />
            <Row label="Chest depth" value={inches(horseInches.chest_depth_inches)} />
            <Row label="Neck" value={inches(horseInches.neck_length_inches)} />
            <Row label="Shoulder angle" value={degrees(m.horse?.shoulder_angle_deg)} />
            <Row label="Hip angle" value={degrees(m.horse?.hip_angle_deg)} />
            <Row label="Back" value={m.horse?.back_profile ?? "—"} />
          </View>
        ) : null}

        {/* Rider and pair */}
        <View className="bg-card rounded-3xl p-4 mb-4">
          <Typography.SubHeading1 className="text-primaryText mb-1">
            Seat and position
          </Typography.SubHeading1>
          <Row
            label="Seat position"
            value={
              typeof dyad.seat_position_ratio === "number"
                ? `${Math.round(dyad.seat_position_ratio * 100)}% back from the withers`
                : "—"
            }
          />
          <Row
            label="Stirrup length"
            value={
              typeof dyad.stirrup_length_ratio === "number"
                ? `${Math.round(dyad.stirrup_length_ratio * 100)}% of leg`
                : "—"
            }
          />
          <Row
            label="Heel-hip-shoulder"
            value={degrees(dyad.heel_hip_shoulder_alignment_deg)}
          />
        </View>

        {/* The part that stops false positives */}
        <View className="bg-card rounded-3xl p-4 mb-4">
          <Typography.SubHeading1 className="text-primaryText mb-1">
            Your normal at rest
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText mb-2">
            This is what you look like standing still. Run analysis measures
            against these numbers, so what is simply how you are built does not
            get called a fault every time.
          </Typography.Body2>
          <Row label="Shoulder tilt" value={degrees(asym.rider_shoulder_tilt_deg)} />
          <Row label="Hip tilt" value={degrees(asym.rider_hip_tilt_deg)} />
          <Row
            label="Horse standing square"
            value={asym.horse_stance_even ? "Yes" : "No"}
          />
          {asym.notes ? (
            <Typography.Body2 className="text-secondaryText mt-2">{asym.notes}</Typography.Body2>
          ) : null}
        </View>

        {isBaselineStale(baseline) ? (
          <View className="bg-card rounded-3xl p-4 mb-4">
            <Typography.Body2 className="text-secondaryText">
              This baseline is over six months old. Condition, tack and — for a
              junior rider — height all move. Worth another lap.
            </Typography.Body2>
          </View>
        ) : null}

        <Typography.Caption1 className="text-secondaryText text-center">
          A standing capture measures the pair. It says nothing about how you
          ride — that comes from the run analysis it makes possible.
        </Typography.Caption1>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default BaselineDetailScreen;
