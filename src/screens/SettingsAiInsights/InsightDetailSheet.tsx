import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Button, SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { T_AI_RUN_INSIGHT } from "@/services/supabase/aiInsightsTypes";

type Props = {
  open: boolean;
  insight: T_AI_RUN_INSIGHT | null;
  onClose: () => void;
};

export default function InsightDetailSheet({ open, insight, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!open || !insight) return null;

  const analysis = insight.analysis_data as Record<string, unknown> | undefined;

  return (
    <View className="absolute inset-0 z-60 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[88%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader title="AI coaching insight" onClose={onClose} />
        <ScrollView
          className="px-5 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {insight.runs ? (
            <View className="bg-card border border-border rounded-xl p-4 mb-4">
              <Typography.Caption1 className="text-secondaryText mb-1">
                Analyzed run
              </Typography.Caption1>
              <Typography.Heading3 className="text-primaryText">
                {insight.runs.time_seconds.toFixed(3)}s
              </Typography.Heading3>
              <Typography.Body2 className="text-secondaryText mt-1">
                {new Date(insight.runs.run_date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Typography.Body2>
              {insight.runs.horses?.[0]?.name ? (
                <Typography.Body2 className="text-primaryText mt-2">
                  {insight.runs.horses[0].name}
                </Typography.Body2>
              ) : null}
            </View>
          ) : null}

          {analysis ? (
            <View className="bg-card-secondary rounded-xl p-4 mb-4">
              <Typography.SubHeading2 className="text-primaryText mb-2">
                Quick stats
              </Typography.SubHeading2>
              {analysis.slowest_breakaway ? (
                <View className="flex-row justify-between py-1">
                  <Typography.Body2 className="text-secondaryText">
                    Slowest breakaway
                  </Typography.Body2>
                  <Typography.Body2 className="text-primaryText font-poppins-semibold">
                    {String(analysis.slowest_breakaway).replace("_", " ")}
                  </Typography.Body2>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Typography.SubHeading2 className="text-primaryText mb-2">
              Analysis
            </Typography.SubHeading2>
            <Typography.Body2 className="text-primaryText leading-6">
              {insight.insight_text}
            </Typography.Body2>
          </View>

          {insight.confidence_score != null ? (
            <View className="mb-4">
              <Typography.Body2 className="text-secondaryText mb-2">
                Confidence {(insight.confidence_score * 100).toFixed(0)}%
              </Typography.Body2>
              <View className="h-2 bg-card-secondary rounded-full overflow-hidden">
                <View
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, (insight.confidence_score as number) * 100)}%`,
                  }}
                />
              </View>
            </View>
          ) : null}

          {insight.model_version ? (
            <Typography.Caption1 className="text-placeholderText mb-4">
              Model {String(insight.model_version).toUpperCase()}
            </Typography.Caption1>
          ) : null}

          <Button title="Close" variant="outlined" onPress={onClose} />
        </ScrollView>
      </View>
    </View>
  );
}
