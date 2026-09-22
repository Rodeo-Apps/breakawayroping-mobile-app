import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import EntriesProgressScroll from "./components/EntriesProgressScroll";

const SettingsEntriesScreen = () => {
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view your progress and run history.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-2">
        <Ionicons name="trending-up" size={26} color={primaryColor} />
        <Typography.Heading2 className="text-primaryText">
          My Progress
        </Typography.Heading2>
      </View>
      <EntriesProgressScroll />
    </View>
  );
};

export default SettingsEntriesScreen;
