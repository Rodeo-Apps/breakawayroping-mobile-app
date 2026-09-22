import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  FloatingRoundedIconButton,
  ScreenWrapper,
} from "@/components";
import { useAuth } from "@/provider/AuthProvider";
import { useAiRunInsights } from "@/services/supabase/useAiRunInsights";
import type { T_AI_RUN_INSIGHT } from "@/services/supabase/aiInsightsTypes";
import { trackInteraction } from "@/analytics";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  canGenerateAiInsightOnFreeTier,
  FREE_TIER_MAX_AI_INSIGHTS,
  hasActivePremiumAccess,
} from "@/utils/premiumEntitlement";
import { hasIapSkuConfiguration } from "@/services/iapService";
import InsightDetailSheet from "./components/InsightDetailSheet";
import RunsPickerPageSheet from "./components/RunsPickerPageSheet";

function getInsightIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "run_analysis":
    case "general":
      return "analytics";
    case "run_analysis":
    case "run":
      return "git-network";
    case "improvement_tip":
    case "improvement":
      return "bulb";
    case "timing":
      return "timer";
    case "technique":
      return "school";
    default:
      return "information-circle";
  }
}

const SettingsAiInsightsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id;

  const {
    insights,
    pickerRuns,
    pickerLoading,
    loading,
    refreshing,
    generating,
    loadData,
    loadPickerRuns,
    requestAiAnalysis,
  } = useAiRunInsights(userId);

  const premium = hasActivePremiumAccess(profile);
  const canRequestMoreInsights = canGenerateAiInsightOnFreeTier(
    premium,
    insights.length,
  );

  const [runsSheetVisible, setRunsSheetVisible] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<T_AI_RUN_INSIGHT | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadData(false);
    }, [userId, loadData]),
  );

  const onRefresh = useCallback(() => {
    void trackInteraction("ai_insights", "pull_refresh", {});
    void loadData(true);
  }, [loadData]);

  const handleSelectRun = useCallback(
    async (runId: string) => {
      if (!canRequestMoreInsights) {
        Alert.alert(
          "AI insight limit reached",
          `Free accounts include ${FREE_TIER_MAX_AI_INSIGHTS} AI insight generation. Subscribe to Premium for unlimited insights.`,
          [
            { text: "Not now", style: "cancel" },
            ...(hasIapSkuConfiguration()
              ? [
                  {
                    text: "View plans",
                    onPress: () => router.push("/subscription-plans"),
                  },
                ]
              : []),
          ],
        );
        return;
      }
      const res = await requestAiAnalysis(runId);
      if (res.ok) {
        void trackInteraction("ai_insights", "generate_insight", {
          run_id: runId,
        });
        setRunsSheetVisible(false);
        Alert.alert(
          "Success",
          "AI analysis generated. Your new insight appears in the list.",
        );
      } else {
        Alert.alert("Error", res.message);
      }
    },
    [canRequestMoreInsights, requestAiAnalysis, router],
  );

  const openRunsPicker = useCallback(() => {
    if (!canRequestMoreInsights) {
      Alert.alert(
        "AI insight limit reached",
        `Free accounts include ${FREE_TIER_MAX_AI_INSIGHTS} AI insight generation. Subscribe to Premium for unlimited insights.`,
        [
          { text: "Not now", style: "cancel" },
          ...(hasIapSkuConfiguration()
            ? [
                {
                  text: "View plans",
                  onPress: () => router.push("/subscription-plans"),
                },
              ]
            : []),
        ],
      );
      return;
    }
    setRunsSheetVisible(true);
  }, [canRequestMoreInsights, router]);

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view GPT-powered coaching insights from your completed
            runs.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading && insights.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-row items-center px-2 py-3 border-b border-border bg-background-secondary">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
          >
            <Ionicons name="arrow-back" size={24} color={primaryColor} />
          </Pressable>
          <View className="flex-1 items-center justify-center">
            <Typography.Heading3 className="text-primaryText">
              AI insights
            </Typography.Heading3>
          </View>
          <View className="w-10 h-10" />
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Typography.Body2 className="text-secondaryText mt-3">
            Loading insights…
          </Typography.Body2>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-2 py-3 border-b border-border bg-background-secondary">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Ionicons name="arrow-back" size={24} color={primaryColor} />
        </Pressable>
        <View className="flex-1 items-center justify-center">
          <Typography.Heading3 className="text-primaryText">AI insights</Typography.Heading3>
        </View>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 py-6 gap-y-6">
          {!premium && insights.length >= FREE_TIER_MAX_AI_INSIGHTS ? (
            <View className="bg-background-secondary rounded-2xl border border-border p-4 gap-y-2">
              <Typography.SubHeading2 className="text-primaryText">
                Free plan limit
              </Typography.SubHeading2>
              <Typography.Body2 className="text-secondaryText">
                You have used your included AI insight. Upgrade to Premium to
                generate unlimited coaching insights from your runs.
              </Typography.Body2>
            </View>
          ) : null}
          <Typography.Body2 className="text-secondaryText">
            Coaching notes generated from your completed time runs. Tap + to pick
            a run and request a new insight.
          </Typography.Body2>

          {insights.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="bulb-outline" size={64} color="#d1d5db" />
              <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
                No AI insights yet
              </Typography.SubHeading1>
              <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
                Complete a run, then tap the + button to choose it and generate
                your first insight.
              </Typography.Body2>
            </View>
          ) : (
            <View className="gap-y-6">
              {insights.map((insight) => (
              <Pressable
                key={insight.id}
                className="bg-background border border-border rounded-2xl p-4 gap-y-2 active:opacity-90"
                onPress={() => setSelectedInsight(insight)}
              >
                <View className="flex-row items-start gap-x-3">
                  <View className="w-12 h-12 rounded-full bg-primary items-center justify-center shrink-0">
                    <Ionicons
                      name={getInsightIcon(insight.insight_type)}
                      size={22}
                      color="#fff"
                    />
                  </View>
                  <View className="flex-1 min-w-0 gap-y-1">
                    <View className="flex-row items-center gap-x-3">
                      <Ionicons name="sparkles" size={14} color={primaryColor} />
                      <Typography.Body2 className="text-primary font-poppins-semibold">
                        AI analysis
                      </Typography.Body2>
                    </View>
                    <Typography.Body2 className="text-secondaryText">
                      {new Date(insight.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {insight.runs?.horses?.[0]?.name
                        ? ` · ${insight.runs.horses[0].name}`
                        : ""}
                    </Typography.Body2>
                  </View>
                  {insight.confidence_score != null ? (
                    <View className="bg-primary/15 px-2 py-1 rounded-lg shrink-0">
                      <Typography.Caption1 className="text-primary font-poppins-bold">
                        {(insight.confidence_score * 100).toFixed(0)}%
                      </Typography.Caption1>
                    </View>
                  ) : null}
                </View>
                {insight.runs ? (
                  <View className="flex-row items-center gap-x-3">
                    <Ionicons name="timer" size={16} color="#6b7280" />
                    <Typography.Body2 className="text-secondaryText">
                      {insight.runs.time_seconds.toFixed(2)}s ·{" "}
                      {new Date(insight.runs.run_date).toLocaleDateString()}
                    </Typography.Body2>
                  </View>
                ) : null}
                <Text
                  className="text-primaryText font-poppins-medium text-base leading-5"
                  numberOfLines={3}
                >
                  {insight.insight_text}
                </Text>
              </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <FloatingRoundedIconButton
        icon={<Ionicons name="add" size={28} color="#fff" />}
        onPress={openRunsPicker}
        accessibilityLabel="Choose a run to analyze"
      />

      <RunsPickerPageSheet
        visible={runsSheetVisible}
        onClose={() => setRunsSheetVisible(false)}
        runs={pickerRuns}
        loading={pickerLoading}
        generating={generating}
        onOpen={loadPickerRuns}
        onSelectRun={handleSelectRun}
      />

      <InsightDetailSheet
        open={!!selectedInsight}
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
      />
    </View>
  );
};

export default SettingsAiInsightsScreen;
