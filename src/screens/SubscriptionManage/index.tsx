import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  View,
} from "react-native";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { showManageSubscriptionsIOS } from "react-native-iap";
import { ScreenWrapper } from "@/components";
import Button from "@/components/ui/Button";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import {
  fetchLatestBackendSubscription,
  hasIapSkuConfiguration,
  PREMIUM_SUBSCRIPTION_SKUS,
  type BackendSubscriptionSnapshot,
} from "@/services/iapService";
import {
  hasActivePremiumAccess,
  hasActivePromoAccess,
  hasLifetimeAccess,
  shouldShowSubscriptionPlans,
} from "@/utils/premiumEntitlement";

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const SubscriptionManageScreen = () => {
  useTrackScreenFocus("subscription_manage");
  const { user, profile, refreshProfile } = useAuth();
  const [snapshot, setSnapshot] = useState<BackendSubscriptionSnapshot | null>(
    null,
  );
  const [loadingSnap, setLoadingSnap] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingSnap(true);
      const row = await fetchLatestBackendSubscription(user.id);
      setSnapshot(row);
    } catch {
      setSnapshot(null);
    } finally {
      setLoadingSnap(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return undefined;
      void refreshProfile();
      void loadSnapshot();
      return undefined;
    }, [user?.id, loadSnapshot, refreshProfile]),
  );

  const openStoreSubscriptionManagement = async () => {
    if (Platform.OS === "ios") {
      await showManageSubscriptionsIOS();
      return;
    }

    const androidPackage =
      Constants.expoConfig?.android?.package ?? "com.breakawayropingpro.app";
    const sku =
      snapshot?.product_id ??
      PREMIUM_SUBSCRIPTION_SKUS[0] ??
      "";

    if (!sku) {
      Alert.alert(
        "Google Play",
        "Open Google Play → Payments & subscriptions → Subscriptions to manage your plan.",
      );
      return;
    }

    const url = `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(
      androidPackage,
    )}&sku=${encodeURIComponent(sku)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(
        `https://play.google.com/store/account/subscriptions`,
      );
    }
  };

  const onCancelPress = () => {
    Alert.alert(
      "Manage subscription",
      Platform.OS === "ios"
        ? "You will open Apple’s subscription management screen. Turn off auto-renew to cancel at the end of the current period."
        : "You will open Google Play’s subscription center where you can cancel your plan.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            void openStoreSubscriptionManagement().catch((e) =>
              Alert.alert(
                "Could not open subscriptions",
                e instanceof Error ? e.message : "Try again from device settings.",
              ),
            );
          },
        },
      ],
    );
  };

  const premium = hasActivePremiumAccess(profile);
  const lifetime = hasLifetimeAccess(profile);
  const promoActive = hasActivePromoAccess(profile);

  if (!user?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 py-6 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view your subscription.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (!premium) {
    return (
      <ScreenWrapper withoutTPadding withoutBPadding>
        <ScrollView
          contentContainerClassName="px-5 py-6 gap-y-6"
          showsVerticalScrollIndicator={false}
        >
          <Typography.SubHeading1 className="text-primaryText">
            No active subscription
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText">
            Subscribe to unlock the Health Dashboard and premium features.
          </Typography.Body2>
          {shouldShowSubscriptionPlans(profile) && hasIapSkuConfiguration() ? (
            <Button
              title="View plans"
              onPress={() => router.push("/subscription-plans")}
            />
          ) : shouldShowSubscriptionPlans(profile) ? (
            <Typography.Caption1 className="text-secondaryText">
              In-app purchases are not configured for this build.
            </Typography.Caption1>
          ) : null}

          <View className="flex-row justify-center gap-x-4 pt-2">
            <Typography.Caption1
              className="text-primary underline"
              onPress={() => Linking.openURL("https://breakawayroping.pro/terms")}
            >
              Terms of Service
            </Typography.Caption1>
            <Typography.Caption1 className="text-secondaryText">|</Typography.Caption1>
            <Typography.Caption1
              className="text-primary underline"
              onPress={() => Linking.openURL("https://breakawayroping.pro/privacy")}
            >
              Privacy Policy
            </Typography.Caption1>
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  if (lifetime) {
    return (
      <ScreenWrapper withoutTPadding withoutBPadding>
        <ScrollView
          contentContainerClassName="px-5 py-6 gap-y-6 pb-10"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Lifetime access
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              You have lifetime access to all premium features.
            </Typography.Body2>
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  if (promoActive) {
    return (
      <ScreenWrapper withoutTPadding withoutBPadding>
        <ScrollView
          contentContainerClassName="px-5 py-6 gap-y-6 pb-10"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Promo access
            </Typography.SubHeading2>
            <Typography.Body2 className="text-primaryText">
              Premium features are active via promo code.
            </Typography.Body2>
          </View>

          <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Access ends
            </Typography.SubHeading2>
            <Typography.Body2 className="text-primaryText">
              {formatDate(profile?.promo_expires_at)}
            </Typography.Body2>
            <Typography.Caption1 className="text-secondaryText">
              After this time, premium access will end unless you subscribe.
            </Typography.Caption1>
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  const productLabel =
    snapshot?.product_id ??
    (PREMIUM_SUBSCRIPTION_SKUS.length
      ? PREMIUM_SUBSCRIPTION_SKUS.join(", ")
      : "Premium");

  const renewsOrEnds =
    profile?.premium_expires_at ?? snapshot?.expires_at ?? null;

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <ScrollView
        contentContainerClassName="px-5 py-6 gap-y-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Active plan
          </Typography.SubHeading2>
          <Typography.Body2 className="text-primaryText">{productLabel}</Typography.Body2>
          {loadingSnap ? (
            <ActivityIndicator size="small" />
          ) : snapshot?.status ? (
            <Typography.Caption1 className="text-secondaryText">
              Status: {snapshot.status}
              {snapshot.auto_renew_status === false ? " · Auto-renew off" : ""}
            </Typography.Caption1>
          ) : null}
        </View>

        <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Current period ends
          </Typography.SubHeading2>
          <Typography.Body2 className="text-primaryText">
            {formatDate(renewsOrEnds)}
          </Typography.Body2>
          <Typography.Caption1 className="text-secondaryText">
            After this time, access may end unless the subscription renews.
          </Typography.Caption1>
        </View>

        <Button title="Cancel subscription" variant="outlined" onPress={onCancelPress} />

        <Button
          variant="outlined"
          title="Browse all plans"
          onPress={() => router.push("/subscription-plans")}
        />
      </ScrollView>
    </ScreenWrapper>
  );
};

export default SubscriptionManageScreen;
