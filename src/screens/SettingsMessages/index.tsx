import React from "react";
import { Redirect } from "expo-router";

/** More → Messages: jump to the Messages tab. */
const SettingsMessagesScreen = () => {
  return <Redirect href="/(tabs)/(messages)" />;
};

export default SettingsMessagesScreen;
