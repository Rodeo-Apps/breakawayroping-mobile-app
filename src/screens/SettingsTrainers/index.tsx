import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import TrainersContent from "./TrainersContent";

const SettingsTrainersScreen = () => {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to browse trainers and create your coaching profile.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TrainersContent />
    </View>
  );
};

export default SettingsTrainersScreen;
