import { View } from "react-native";
import React, { memo } from "react";
import { Typography } from "@/utils/typography";
import { useTimeRun } from "@/services/supabase/useTimeRun";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

const TimeRun = ({ id }: { id: string }) => {
  const { run, loading, error } = useTimeRun(id);
  const primaryColor = useCSSVariable("--color-primary") as string;

  if (loading) {
    return (
      <View>
        <Typography.Caption1 className="text-secondaryText">
          Loading run...
        </Typography.Caption1>
      </View>
    );
  }

  if (error) {
    return (
      <View>
        <Typography.Caption1 className="text-danger">
          {error}
        </Typography.Caption1>
      </View>
    );
  }

  if (!run) return null;

  const formattedRunDate = run.run_date
    ? new Date(run.run_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View className="flex-row items-start bg-sky-50 rounded-xl p-4 gap-x-3">
      <Ionicons name="timer" size={24} color={primaryColor} />
      <View className="flex-1 gap-y-1">
        <Typography.SubHeading2 className="text-primary">
          {run.time_seconds.toFixed(2)}s
        </Typography.SubHeading2>

        <View className="flex-row items-center gap-x-2">
          {!!run.time_division && (
            <Typography.Caption1 className="text-blue-500">
              {run.time_division}
            </Typography.Caption1>
          )}
          {!!run.status && (
            <View
              className={`px-2 py-1 rounded-full ${
                run.status === "complete" ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              <Typography.Caption1 className="text-secondaryText">
                {run.status}
              </Typography.Caption1>
            </View>
          )}
        </View>

        {!!formattedRunDate && (
          <Typography.Caption1 className="text-placeholderText">
            {formattedRunDate}
          </Typography.Caption1>
        )}

        {(run.breakaway1_time != null ||
          run.breakaway2_time != null ||
          run.breakaway3_time != null) && (
          <View className="flex-row flex-wrap gap-x-3 gap-y-1 pt-1">
            {run.breakaway1_time != null && (
              <Typography.Body2 className="text-secondaryText">
                B1: {run.breakaway1_time.toFixed(2)}s
              </Typography.Body2>
            )}
            {run.breakaway2_time != null && (
              <Typography.Body2 className="text-secondaryText">
                B2: {run.breakaway2_time.toFixed(2)}s
              </Typography.Body2>
            )}
            {run.breakaway3_time != null && (
              <Typography.Body2 className="text-secondaryText">
                B3: {run.breakaway3_time.toFixed(2)}s
              </Typography.Body2>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default memo(TimeRun);
