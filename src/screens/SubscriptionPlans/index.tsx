import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components";
import Button from "@/components/ui/Button";
import SubscriptionPlanCard from "@/components/ui/SubscriptionPlanCard";
import { Typography } from "@/utils/typography";
import {
  SUBSCRIPTION_AUTO_RENEW_DISCLOSURE,
  getTrialInfo,
} from "@/utils/subscriptionProductDisplay";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import {
  fetchSubscriptionProducts,
  hasIapSkuConfiguration,
  purchaseSubscription,
  reconcilePremiumAfterAuth,
  restoreUserPurchases,
} from "@/services/iapService";
import type { ProductSubscription } from "react-native-iap";

const SubscriptionPlansScreen = () => {
  useTrackScreenFocus("subscription_plans");
  const { user, refreshProfile } = useAuth();
  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingSku, setBuyingSku] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!hasIapSkuConfiguration()) {
      setProducts([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await fetchSubscriptionProducts();
      setProducts(list);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Could not load plans",
        error instanceof Error ? error.message : "Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSubscribe = async (sku: string) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to subscribe.");
      return;
    }
    try {
      setBuyingSku(sku);
      await purchaseSubscription(sku, user.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Purchase could not start.";
      Alert.alert("Purchase", message);
    } finally {
      setBuyingSku(null);
    }
  };

  const onRestore = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to restore purchases.");
      return;
    }
    try {
      setRestoring(true);
      await restoreUserPurchases();
      await reconcilePremiumAfterAuth(user.id);
      await refreshProfile();
      Alert.alert(
        "Restore complete",
        "Your subscription status has been updated.",
      );
    } catch (error) {
      Alert.alert(
        "Restore failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setRestoring(false);
    }
  };

  if (!hasIapSkuConfiguration()) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 py-6 gap-y-6 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Subscription products are not configured for this build. Add
            EXPO_PUBLIC_IAP_SUBSCRIPTION_SKUS (or monthly/yearly SKUs) to enable
            purchases.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 py-6 gap-y-6 pb-10"
      >
        <View className="gap-y-2">
          <Typography.SubHeading1 className="text-primaryText">
            Breakaway Connect Premium
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText">
            Start with a free trial — no charge until the trial ends. A payment
            method is required and you can cancel anytime.
          </Typography.Body2>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator />
          </View>
        ) : products.length === 0 ? (
          <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
            <Typography.Body2 className="text-secondaryText">
              No subscription offers were returned from the store. Confirm the
              product IDs match your App Store Connect and Play Console setup.
            </Typography.Body2>
          </View>
        ) : (
          <View className="gap-y-4">
            {products.map((p) => (
              <SubscriptionPlanCard
                key={p.id}
                product={p}
                loading={buyingSku === p.id}
                trialInfo={getTrialInfo(p)}
                onSubscribe={onSubscribe}
              />
            ))}
            <Typography.Caption1 className="text-secondaryText">
              {SUBSCRIPTION_AUTO_RENEW_DISCLOSURE}
            </Typography.Caption1>
          </View>
        )}

        <Button
          variant="outlined"
          title="Restore purchases"
          loading={restoring}
          onPress={() => void onRestore()}
        />

        <Button
          variant="outlined"
          title="View my current plan"
          onPress={() => router.push("/subscription-manage")}
        />

        <View className="flex-row justify-center gap-x-4 pt-2">
          <Typography.Caption1
            className="text-primary underline"
            textProps={{
              onPress: () => Linking.openURL("https://breakawayroping.pro/terms"),
            }}
          >
            Terms of Use
          </Typography.Caption1>
          <Typography.Caption1 className="text-secondaryText">
            |
          </Typography.Caption1>
          <Typography.Caption1
            className="text-primary underline"
            textProps={{
              onPress: () =>
                Linking.openURL("https://breakawayroping.pro/privacy"),
            }}
          >
            Privacy Policy
          </Typography.Caption1>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default SubscriptionPlansScreen;
