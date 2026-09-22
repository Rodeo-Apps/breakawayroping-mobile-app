import React, { useCallback } from "react";
import { FlatList, ListRenderItemInfo, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  EmptyState,
  FloatingRoundedIconButton,
  Loader,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import {
  T_TIME_RUN_ITEM,
  useGetTimeRuns,
} from "@/services/supabase/useGetTimeRuns";
import TimeRunCard from "./components/TimeRunCard";
import { useTrackScreenFocus } from "@/analytics";

const TimeRunsScreen = () => {
  useTrackScreenFocus("time_runs");
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const { loading, timeRuns, error } = useGetTimeRuns();
  const hasRuns = timeRuns.length > 0;

  // Render Time Run Card
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T_TIME_RUN_ITEM>) => {
      return <TimeRunCard item={item} />;
    },
    [],
  );

  // Render Loading
  if (loading) return <Loader message="Loading Time Runs..." />;

  // Render Empty State
  if (!hasRuns)
    return (
      <ScreenWrapper withoutBPadding withoutTPadding>
        <EmptyState
          icon={
            <Ionicons
              name="timer-outline"
              size={26}
              color={secondaryTextColor}
            />
          }
          message={
            error ||
            "No time runs yet. Add your first run to start tracking progress."
          }
        />
        <FloatingRoundedIconButton
          accessibilityLabel="Add time run"
          icon={<Ionicons name="add" size={28} color="#ffffff" />}
          onPress={() => router.push("/add-time-run")}
        />
      </ScreenWrapper>
    );

  // Render Runs
  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <View className="flex-1 py-6 gap-y-6">
        {/* Heading */}
        <View className="gap-y-1 px-5">
          <Typography.Heading3 className="text-primaryText">
            Time Runs
          </Typography.Heading3>
          <Typography.Body1 className="text-secondaryText">
            View your recent timed runs and keep improving each ride.
          </Typography.Body1>
        </View>

        <View className="flex-1">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={timeRuns}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerClassName="px-5 gap-y-4 pb-56"
          />
        </View>
      </View>
      <FloatingRoundedIconButton
        accessibilityLabel="Add time run"
        icon={<Ionicons name="add" size={28} color="#ffffff" />}
        onPress={() => router.push("/add-time-run")}
      />
    </ScreenWrapper>
  );
};

export default TimeRunsScreen;
