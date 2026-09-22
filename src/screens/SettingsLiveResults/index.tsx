import React from "react";
import { View } from "react-native";
import LiveResultsContent from "../LiveResultsContent";

const SettingsLiveResultsScreen = () => {
  return (
    <View className="flex-1 bg-background">
      <LiveResultsContent compactHeader />
    </View>
  );
};

export default SettingsLiveResultsScreen;
