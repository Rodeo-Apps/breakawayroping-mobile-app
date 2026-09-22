import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import EmergencyAlertContent from "../EmergencyAlertContent";

const SettingsEmergencyScreen = () => {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to use emergency alerts, share your location, and contact
            your saved emergency contacts.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <EmergencyAlertContent compactHeader />
    </View>
  );
};

export default SettingsEmergencyScreen;
