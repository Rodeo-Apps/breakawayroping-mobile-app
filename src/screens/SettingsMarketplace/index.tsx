import React from "react";
import { Redirect } from "expo-router";

/** More → Marketplace: jump to the Marketplace tab. */
const SettingsMarketplaceScreen = () => {
  return <Redirect href="/(tabs)/(marketplace)" />;
};

export default SettingsMarketplaceScreen;
