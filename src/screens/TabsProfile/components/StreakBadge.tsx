import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "@/utils/typography";
import { useTrainingStreak } from "@/services/supabase/useTrainingStreak";

type T_STREAK_BADGE_PROPS = {
  userId?: string;
};

/**
 * Quick Win #2 — Training Streak counter.
 * Shows the rider's current consecutive-day training streak (and longest).
 */
const StreakBadge = ({ userId }: T_STREAK_BADGE_PROPS) => {
  const { streak } = useTrainingStreak(userId);

  const flameColor = streak.trainedToday ? "#f97316" : "#9ca3af";
  const dayLabel = streak.currentStreak === 1 ? "day" : "days";

  return (
    <View className="flex-row items-center justify-between bg-background-secondary rounded-xl px-4 py-3">
      <View className="flex-row flex-1 items-center gap-x-3">
        <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center">
          <Ionicons name="flame" size={22} color={flameColor} />
        </View>
        <View className="flex-1">
          <Typography.SubHeading2 className="text-primaryText">
            {streak.currentStreak} {dayLabel} streak
          </Typography.SubHeading2>
          <Typography.Caption1 className="text-secondaryText">
            {streak.trainedToday
              ? "You trained today — keep it going!"
              : "Log a run today to keep your streak alive"}
          </Typography.Caption1>
        </View>
      </View>
      <View className="items-center">
        <Typography.SubHeading2 className="text-primary">
          {streak.longestStreak}
        </Typography.SubHeading2>
        <Typography.Caption1 className="text-secondaryText">best</Typography.Caption1>
      </View>
    </View>
  );
};

export default StreakBadge;
