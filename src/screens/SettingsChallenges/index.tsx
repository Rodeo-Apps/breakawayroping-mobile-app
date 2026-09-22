import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, Loader, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useDailyChallenge } from "@/services/supabase/useDailyChallenge";

const SettingsChallengesScreen = () => {
  const { profile } = useAuth();
  const successColor = (useCSSVariable("--color-success") as string) || "#10b981";
  const { challenge, completed, loading, submitting, complete } =
    useDailyChallenge();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-6 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to take part in daily challenges.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading) {
    return <Loader message="Loading today's challenge..." />;
  }

  return (
    <ScreenWrapper>
      <View className="flex-1 px-5 pt-6 gap-y-5">
        <View className="gap-y-1">
          <Typography.Heading3 className="text-primaryText">
            Today's Challenge
          </Typography.Heading3>
          <Typography.Body2 className="text-secondaryText">
            Complete the daily challenge to earn points and keep your momentum
            going.
          </Typography.Body2>
        </View>

        {!challenge ? (
          <View className="bg-background-secondary rounded-2xl border border-border p-6 items-center gap-y-2">
            <Ionicons name="calendar-outline" size={32} color={successColor} />
            <Typography.SubHeading2 className="text-primaryText text-center">
              No challenge yet
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText text-center">
              Today's challenge hasn't been posted yet. Check back a little
              later!
            </Typography.Body2>
          </View>
        ) : (
          <View className="bg-background-secondary rounded-2xl border border-border p-5 gap-y-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-x-2 rounded-full bg-primary/10 px-3 py-1">
                <Ionicons name="flame" size={16} color={successColor} />
                <Typography.Body2 className="text-xs text-primaryText">
                  {challenge.points} pts
                </Typography.Body2>
              </View>
              {completed && (
                <View className="flex-row items-center gap-x-1 rounded-full bg-success/15 px-3 py-1 border border-success/30">
                  <Ionicons name="checkmark-circle" size={16} color={successColor} />
                  <Typography.Body2 className="text-xs text-success">
                    Completed
                  </Typography.Body2>
                </View>
              )}
            </View>

            <View className="gap-y-1">
              <Typography.SubHeading1 className="text-primaryText">
                {challenge.title}
              </Typography.SubHeading1>
              {!!challenge.description && (
                <Typography.Body2 className="text-secondaryText">
                  {challenge.description}
                </Typography.Body2>
              )}
            </View>

            {completed ? (
              <View className="flex-row items-center justify-center gap-x-2 py-2">
                <Ionicons name="trophy" size={18} color={successColor} />
                <Typography.Body2 className="text-secondaryText">
                  Nice work — see you tomorrow!
                </Typography.Body2>
              </View>
            ) : (
              <Button
                title={submitting ? "Saving..." : "Mark as complete"}
                disabled={submitting}
                onPress={() => void complete()}
              />
            )}
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

export default SettingsChallengesScreen;
