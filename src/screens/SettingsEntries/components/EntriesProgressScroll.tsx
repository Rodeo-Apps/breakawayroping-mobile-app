import React, { useCallback } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Loader } from "@/components";
import StatMetricCard from "@/components/ui/StatMetricCard";
import { Typography } from "@/utils/typography";
import { supabase } from "@/lib/supabase";
import { useMyRunsProgress } from "@/services/supabase/useMyRunsProgress";
import {
  formatRunTime,
  getConsistencyImprovementPercent,
  getDivisionColor,
} from "@/utils/runProgressStats";

const AI_GREEN = "#10b981";
const BLUE = "#3b82f6";

const EntriesProgressScroll = () => {
  const { width } = useWindowDimensions();
  const secondaryText = useCSSVariable("--color-secondaryText") as string;

  const {
    runs,
    horseNamesMap,
    stats,
    filter,
    setFilter,
    selectedDivision,
    setSelectedDivision,
    filteredRuns,
    loading,
  } = useMyRunsProgress();

  const improvementPct = getConsistencyImprovementPercent(stats);
  const consistencyScore =
    stats.bestTime && stats.averageTime
      ? (100 - improvementPct).toFixed(0)
      : "0";

  const generateAIAnalysis = useCallback(async (runId: string) => {
    Alert.alert("AI Analysis", "Generating AI-powered coaching insights...", [
      { text: "OK" },
    ]);
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-run-analysis`;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Not authenticated");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ runId, run_id: runId }),
      });

      let result: { success?: boolean; error?: string };
      try {
        result = await response.json();
      } catch {
        throw new Error(
          response.status === 404
            ? "AI analysis service is not available. Make sure the Edge Function is deployed."
            : `Request failed (${response.status}). The AI analysis service may be unavailable.`,
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate analysis");
      }

      Alert.alert(
        "AI Analysis Complete!",
        "Your personalized coaching insights are ready. Check the AI Insights screen to view them.",
        [{ text: "OK" }],
      );
    } catch (error: unknown) {
      console.error("Error requesting AI analysis:", error);
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error &&
        String((error as { message: string }).message).includes("Run not found")
          ? "This run could not be found. It may have been deleted or the AI analysis service may be unavailable."
          : error && typeof error === "object" && "message" in error
            ? String((error as { message: string }).message)
            : "Failed to generate AI analysis. Please try again.";
      Alert.alert("Analysis Error", msg);
    }
  }, []);

  const requestAIAnalysis = useCallback(() => {
    if (runs.length === 0 || stats.completeRuns === 0) {
      Alert.alert(
        "No Runs Available",
        "Complete at least one run to get AI-powered insights.",
      );
      return;
    }

    const recentCompleteRuns = runs
      .filter((r) => r.status === "complete")
      .slice(0, 10);

    if (recentCompleteRuns.length === 0) {
      Alert.alert(
        "No Complete Runs",
        "You need at least one complete run to get AI analysis.",
      );
      return;
    }

    Alert.alert("Select Run to Analyze", "Choose a recent run:", [
      ...recentCompleteRuns.map((run) => ({
        text: `${run.time_seconds.toFixed(2)}s - ${new Date(run.created_at).toLocaleDateString()}${
          run.horse_id && horseNamesMap[run.horse_id]
            ? ` (${horseNamesMap[run.horse_id]})`
            : ""
        }`,
        onPress: () => void generateAIAnalysis(run.id),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }, [runs, stats.completeRuns, horseNamesMap, generateAIAnalysis]);

  const divisionMinWidth = (width - 76) / 2;

  if (loading) {
    return (
      <View className="flex-1 min-h-[280px]">
        <Loader message="Loading progress…" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-10"
    >
      <View className="flex-row px-4 pt-4 gap-2">
        {(
          [
            { key: "all" as const, label: "All Time" },
            { key: "30" as const, label: "Last 30 Days" },
            { key: "90" as const, label: "Last 90 Days" },
          ] as const
        ).map(({ key, label }) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              className={`flex-1 py-2.5 px-3 rounded-lg border items-center ${
                active
                  ? "bg-primary border-primary"
                  : "bg-background-secondary border-border"
              }`}
            >
              <Typography.Caption1
                className={
                  active
                    ? "text-onPrimary font-poppins-semibold"
                    : "text-secondaryText font-poppins-semibold"
                }
              >
                {label}
              </Typography.Caption1>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between px-5 gap-x-4 py-4">
        <StatMetricCard
          icon="flag"
          iconColor={BLUE}
          value={String(stats.totalRuns)}
          label="Total Runs"
        />
        <StatMetricCard
          icon="checkmark-circle"
          iconColor="#10b981"
          value={String(stats.completeRuns)}
          label="Complete"
        />
      </View>
      <View className="flex-row items-center justify-between px-5 gap-x-4">
        <StatMetricCard
          icon="trophy"
          iconColor="#fbbf24"
          value={stats.bestTime ? `${formatRunTime(stats.bestTime)}s` : "-"}
          label="Best Time"
        />
        <StatMetricCard
          icon="stats-chart"
          iconColor="#8b5cf6"
          value={
            stats.averageTime ? `${formatRunTime(stats.averageTime)}s` : "-"
          }
          label="Average Time"
        />
      </View>

      {stats.completeRuns > 0 ? (
        <Pressable
          onPress={() => void requestAIAnalysis()}
          className="mx-4 mt-4 rounded-2xl border-2 border-emerald-500 bg-background-secondary overflow-hidden active:opacity-90"
        >
          <View className="flex-row items-center p-4">
            <View
              className="w-12 h-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: AI_GREEN }}
            >
              <Ionicons name="sparkles" size={24} color="#fff" />
            </View>
            <View className="flex-1">
              <Typography.SubHeading2 className="text-primaryText">
                Get AI Coaching Insights
              </Typography.SubHeading2>
              <Typography.Caption1 className="text-secondaryText mt-0.5">
                Personalized analysis powered by GPT-4
              </Typography.Caption1>
            </View>
            <Ionicons name="chevron-forward" size={24} color={AI_GREEN} />
          </View>
        </Pressable>
      ) : null}

      {stats.bestTime != null && stats.averageTime != null ? (
        <View className="mx-4 mt-4 mb-4 p-5 rounded-2xl bg-background-secondary border border-border">
          <View className="flex-row justify-between items-center mb-2">
            <Typography.SubHeading2 className="text-primaryText">
              Consistency Score
            </Typography.SubHeading2>
            <Typography.Heading2 className="text-primary tabular-nums">
              {consistencyScore}%
            </Typography.Heading2>
          </View>
          <Typography.Body2 className="text-secondaryText mb-4">
            Your times are {improvementPct.toFixed(0)}% consistent with your
            best run
          </Typography.Body2>
          <View className="h-3 rounded-full bg-background overflow-hidden">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${100 - improvementPct}%` }}
            />
          </View>
        </View>
      ) : null}

      {Object.keys(stats.divisionBreakdown).length > 0 ? (
        <View className="mx-4 mb-4 p-5 rounded-2xl bg-background-secondary border border-border">
          <Typography.SubHeading2 className="text-primaryText mb-4">
            Division Breakdown
          </Typography.SubHeading2>
          <View className="flex-row flex-wrap gap-3">
            {Object.entries(stats.divisionBreakdown)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([division, count]) => {
                const color = getDivisionColor(division);
                const selected = selectedDivision === division;
                return (
                  <Pressable
                    key={division}
                    onPress={() =>
                      setSelectedDivision(selected ? null : division)
                    }
                    className={`rounded-xl border-2 p-4 items-center flex-1 ${
                      selected ? "bg-primary/10" : "bg-background"
                    }`}
                    style={{
                      borderColor: color,
                      minWidth: divisionMinWidth,
                    }}
                  >
                    <View
                      className="px-3 py-1.5 rounded-xl mb-2"
                      style={{ backgroundColor: color }}
                    >
                      <Typography.SubHeading2 className="text-white">
                        {division}
                      </Typography.SubHeading2>
                    </View>
                    <Typography.SubHeading2 className="text-primaryText">
                      {count} runs
                    </Typography.SubHeading2>
                    <Typography.Caption1 className="text-secondaryText">
                      {((count / stats.completeRuns) * 100).toFixed(0)}%
                    </Typography.Caption1>
                  </Pressable>
                );
              })}
          </View>
          {selectedDivision ? (
            <Pressable
              onPress={() => setSelectedDivision(null)}
              className="mt-3 py-2.5 items-center"
            >
              <Typography.Body2 className="text-primary font-poppins-semibold">
                Clear Filter
              </Typography.Body2>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="px-4 pt-2">
        <View className="flex-row justify-between items-center mb-4">
          <Typography.SubHeading2 className="text-primaryText">
            Run History
          </Typography.SubHeading2>
          {selectedDivision ? (
            <View
              className="px-3 py-1.5 rounded-xl"
              style={{
                backgroundColor: getDivisionColor(selectedDivision),
              }}
            >
              <Typography.Caption1 className="text-white font-poppins-semibold">
                {selectedDivision} Only
              </Typography.Caption1>
            </View>
          ) : null}
        </View>

        {filteredRuns.length === 0 ? (
          <View className="bg-background-secondary rounded-xl border border-border py-12 px-6 items-center">
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={secondaryText}
            />
            <Typography.Body2 className="text-secondaryText text-center mt-3">
              {selectedDivision
                ? `No ${selectedDivision} runs found`
                : "No runs recorded yet. Start tracking your runs!"}
            </Typography.Body2>
          </View>
        ) : (
          filteredRuns.map((run) => (
            <View
              key={run.id}
              className="bg-background-secondary rounded-xl border border-border p-4 mb-3"
            >
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2 flex-wrap flex-1">
                  <Typography.Heading2 className="text-primaryText tabular-nums">
                    {formatRunTime(run.time_seconds)}s
                  </Typography.Heading2>
                  {run.time_division ? (
                    <View
                      className="px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: getDivisionColor(run.time_division),
                      }}
                    >
                      <Typography.Caption1 className="text-white font-poppins-semibold">
                        {run.time_division}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                  {run.status !== "complete" ? (
                    <View className="px-2 py-1 rounded-lg bg-amber-500">
                      <Typography.Caption1 className="text-white font-poppins-semibold uppercase">
                        {run.status}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                </View>
                <Typography.Body2 className="text-secondaryText">
                  {new Date(run.created_at).toLocaleDateString()}
                </Typography.Body2>
              </View>

              {run.horse_id && horseNamesMap[run.horse_id] ? (
                <View className="flex-row items-center gap-1.5 mb-2">
                  <MaterialCommunityIcons
                    name="horse"
                    size={16}
                    color={secondaryText}
                  />
                  <Typography.Body2 className="text-secondaryText">
                    {horseNamesMap[run.horse_id]}
                  </Typography.Body2>
                </View>
              ) : null}

              {stats.bestTime === run.time_seconds ? (
                <View className="flex-row items-center gap-1.5 self-start bg-amber-100 px-2.5 py-1.5 rounded-lg mt-1">
                  <Ionicons name="trophy" size={14} color="#fbbf24" />
                  <Typography.Caption1 className="text-amber-900 font-poppins-semibold">
                    Personal Best
                  </Typography.Caption1>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default EntriesProgressScroll;
