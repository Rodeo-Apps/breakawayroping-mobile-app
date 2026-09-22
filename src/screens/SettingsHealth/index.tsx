import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import VetRecordsContent from "../VetRecordsContent";

const SettingsHealthScreen = () => {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view vet visits, vaccinations, documents, and contacts
            for your horses.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <VetRecordsContent compactHeader />
    </View>
  );
};

export default SettingsHealthScreen;
