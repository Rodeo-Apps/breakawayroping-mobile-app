import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import VideoAnalysisContent from "../VideoAnalysisContent";

const SettingsVideoScreen = () => {
  useTrackScreenFocus("video_analysis");
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to upload videos, run AI breakaway analysis, and compare runs.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <VideoAnalysisContent compactHeader />
    </View>
  );
};

export default SettingsVideoScreen;
