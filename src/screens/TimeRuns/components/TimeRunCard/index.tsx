import { View, Text, Pressable } from "react-native";
import React, { memo } from "react";
import { T_TIME_RUN_ITEM } from "@/services/supabase/useGetTimeRuns";
import { Typography } from "@/utils/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString();
};

const formatRunTime = (seconds?: number | null) => {
  if (typeof seconds !== "number") return "--";
  return `${seconds.toFixed(2)}s`;
};

const TimeRunCard = memo(({ item }: { item: T_TIME_RUN_ITEM }) => {
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  return (
    <Pressable className="bg-background-secondary rounded-2xl border border-border px-4 py-3 gap-y-2">
      <View className="flex-row items-center justify-between">
        <Typography.SubHeading2 className="text-primaryText">
          {formatRunTime(item.time_seconds)}
        </Typography.SubHeading2>
        <Typography.Caption1 className="text-secondaryText">
          {formatDate(item.run_date || item.created_at)}
        </Typography.Caption1>
      </View>

      <View className="flex-row items-center gap-x-2">
        <MaterialCommunityIcons
          name="horse"
          size={20}
          color={primaryTextColor}
        />
        <Typography.Body2 className="text-primaryText">
          {item.horse_name || "Unknown"}
        </Typography.Body2>
      </View>

      <View className="flex-row items-center gap-x-4">
        <Typography.Caption1 className="text-secondaryText">
          B1 {item.breakaway1_time?.toFixed?.(2) ?? "--"}
        </Typography.Caption1>
        <Typography.Caption1 className="text-secondaryText">
          B2 {item.breakaway2_time?.toFixed?.(2) ?? "--"}
        </Typography.Caption1>
        <Typography.Caption1 className="text-secondaryText">
          B3 {item.breakaway3_time?.toFixed?.(2) ?? "--"}
        </Typography.Caption1>
        <Typography.Caption1 className="text-secondaryText">
          Pen {item.penalties ?? 0}
        </Typography.Caption1>
      </View>
    </Pressable>
  );
});

export default TimeRunCard;
