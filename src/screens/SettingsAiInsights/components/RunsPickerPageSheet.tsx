import React, { useEffect } from "react";
import {
  Modal,
  Platform,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SheetFormHeader, EmptyState } from "@/components";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { T_AI_INSIGHT_RUN } from "@/services/supabase/aiInsightsTypes";
import type { RunsPickerPageSheetProps } from "./types";

export default function RunsPickerPageSheet({
  visible,
  onClose,
  runs,
  loading,
  generating,
  onOpen,
  onSelectRun,
}: RunsPickerPageSheetProps) {
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;

  useEffect(() => {
    if (visible) onOpen();
  }, [visible, onOpen]);

  const runSubtitle = (run: T_AI_INSIGHT_RUN) => {
    const horse = run.horses?.[0]?.name;
    const date = new Date(run.run_date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return horse ? `${date} · ${horse}` : date;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={
        Platform.OS === "ios" ? "pageSheet" : undefined
      }
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Select a run" onClose={onClose} />

        {loading ? (
          <View className="flex-1 justify-center items-center py-16 px-5">
            <ActivityIndicator size="large" color={primaryColor} />
            <Typography.Body2 className="text-secondaryText mt-3 text-center">
              Loading your time runs…
            </Typography.Body2>
          </View>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={
              <Ionicons name="timer-outline" size={56} color="#d1d5db" />
            }
            message="No completed runs yet. Finish a run to generate AI coaching."
          />
        ) : (
          <ScrollView
            className="flex-1 px-5 pt-2"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Typography.Caption1 className="text-secondaryText mb-1">
              Tap a completed run to request a new AI insight.
            </Typography.Caption1>
            {runs.map((run) => (
              <Pressable
                key={run.id}
                disabled={generating}
                onPress={() => void onSelectRun(run.id)}
                className={`flex-row items-center gap-x-3 bg-background border border-border rounded-2xl p-4 mb-2 active:opacity-90 ${
                  generating ? "opacity-45" : ""
                }`}
              >
                <View className="w-11 h-11 rounded-full bg-primary/15 items-center justify-center shrink-0">
                  <Ionicons name="timer" size={22} color={primaryColor} />
                </View>
                <View className="flex-1 min-w-0 gap-y-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold">
                    {run.time_seconds.toFixed(3)}s
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    {runSubtitle(run)}
                  </Typography.Caption1>
                </View>
                {generating ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
