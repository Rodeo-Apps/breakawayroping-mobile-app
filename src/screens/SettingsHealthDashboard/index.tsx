import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { hasActivePremiumAccess } from "@/utils/premiumEntitlement";
import SubscriptionPaywall from "@/components/ui/SubscriptionPaywall";
import HealthDashboardContent from "../HealthDashboardContent";

const SettingsHealthDashboardScreen = () => {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view health records, medications, and recovery metrics
            for your horses.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (!hasActivePremiumAccess(profile)) {
    return (
      <ScreenWrapper withoutTPadding withoutBPadding>
        <View className="flex-1 justify-center">
          <SubscriptionPaywall
            title="Premium required"
            description="Advanced health tracking (Health Dashboard) is included with Breakaway Connect Premium. Subscribe to track vet records, medications, and recovery metrics for your horses."
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <HealthDashboardContent compactHeader />
    </View>
  );
};

export default SettingsHealthDashboardScreen;
