import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScreenWrapper } from "@/components";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SubscriptionPlanCard from "@/components/ui/SubscriptionPlanCard";
import { Typography } from "@/utils/typography";
import {
  SUBSCRIPTION_AUTO_RENEW_DISCLOSURE,
  getTrialInfo,
} from "@/utils/subscriptionProductDisplay";
import { useAuth } from "@/provider/AuthProvider";
import { usePromoCode } from "@/services/supabase/usePromoCode";
import {
  fetchSubscriptionProducts,
  hasIapSkuConfiguration,
  purchaseSubscription,
} from "@/services/iapService";
import { hasActivePremiumAccess } from "@/utils/premiumEntitlement";
import type { ProductSubscription } from "react-native-iap";

const TRIAL_BULLETS = [
  "Your first month is completely free",
  "A valid payment method is required to activate",
  "No charge until the free trial period ends",
  "Cancel anytime before the trial ends — no fee",
];

const SignupPaywallScreen = () => {
  const { user, profile, clearNewSignup } = useAuth();
  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [buyingSku, setBuyingSku] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | undefined>();
  const { redeemPromoCode, redeeming } = usePromoCode();

  const loadProducts = useCallback(async () => {
    if (!hasIapSkuConfiguration()) {
      setLoadingProducts(false);
      return;
    }
    try {
      const list = await fetchSubscriptionProducts();
      setProducts(list);
    } catch {
      // Fail silently — user can still skip or use a promo code
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Navigate home as soon as premium access is granted (purchase or promo)
  useEffect(() => {
    if (hasActivePremiumAccess(profile)) {
      clearNewSignup();
      router.replace("/(tabs)/(home)");
    }
  }, [profile, clearNewSignup]);

  const onSkip = () => {
    clearNewSignup();
    router.replace("/(tabs)/(home)");
  };

  const onSubscribe = async (sku: string) => {
    if (!user?.id) return;
    try {
      setBuyingSku(sku);
      await purchaseSubscription(sku, user.id);
      // IapPurchaseBridge processes the purchase and updates the profile;
      // the useEffect above then navigates home automatically.
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Purchase could not start.";
      Alert.alert("Purchase", message);
    } finally {
      setBuyingSku(null);
    }
  };

  const onRedeemPromo = async () => {
    setPromoError(undefined);
    const result = await redeemPromoCode(promoCode);
    if (result.success) {
      setPromoCode("");
      // Profile update triggers useEffect above → navigates home
    } else {
      setPromoError(result.message);
    }
  };

  // Derive trial duration from the first product that has a free trial
  const trialProduct = products.find((p) => getTrialInfo(p)?.hasTrial);
  const trialDurationLabel =
    trialProduct ? (getTrialInfo(trialProduct)?.durationLabel ?? "1 month") : "1 month";

  const showPlans = hasIapSkuConfiguration();
  const hasTrialOffer = !loadingProducts && !!trialProduct;

  return (
    // ScreenWrapper without withoutTPadding/withoutBPadding applies safe-area
    // insets automatically via useSafeAreaInsets inside the component.
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 py-4 gap-y-6 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="gap-y-1">
          <Typography.Heading1 className="text-primaryText">
            Welcome to Breakaway Connect!
          </Typography.Heading1>
          <Typography.Body2 className="text-secondaryText">
            Choose a plan or enter a promo code to unlock premium features. You
            can also skip and explore the free tier.
          </Typography.Body2>
        </View>

        {/* Introductory Offer Banner */}
        {(hasTrialOffer || loadingProducts) && showPlans && (
          <View className="bg-primary rounded-2xl p-4 gap-y-3">
            <View className="gap-y-1">
              <Typography.SubHeading1 className="text-white">
                {loadingProducts
                  ? "Introductory Offer"
                  : `${trialDurationLabel} Free Trial`}
              </Typography.SubHeading1>
              <Typography.Body2 className="text-white opacity-90">
                New subscribers get their first{" "}
                {loadingProducts ? "period" : trialDurationLabel} completely
                free. A payment method is required to activate.
              </Typography.Body2>
            </View>

            <View className="gap-y-2">
              {TRIAL_BULLETS.map((point) => (
                <View key={point} className="flex-row items-start gap-x-2">
                  <Feather
                    name="check-circle"
                    size={15}
                    color="white"
                    style={{ marginTop: 2 }}
                  />
                  <Typography.Caption1 className="text-white opacity-90 flex-1">
                    {point}
                  </Typography.Caption1>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Subscription Plans */}
        {showPlans &&
          (loadingProducts ? (
            <View className="py-8 items-center">
              <ActivityIndicator />
            </View>
          ) : products.length > 0 ? (
            <View className="gap-y-4">
              {products.map((p) => (
                <SubscriptionPlanCard
                  key={p.id}
                  product={p}
                  loading={buyingSku === p.id}
                  trialInfo={getTrialInfo(p)}
                  onSubscribe={(sku) => {
                    void onSubscribe(sku);
                  }}
                />
              ))}
              <Typography.Caption1 className="text-secondaryText">
                {SUBSCRIPTION_AUTO_RENEW_DISCLOSURE}
              </Typography.Caption1>
            </View>
          ) : null)}

        {/* Promo Code */}
        <View className="bg-background-secondary rounded-2xl p-4 gap-y-3">
          <View className="gap-y-1">
            <Typography.SubHeading2 className="text-primaryText">
              Have a promo code?
            </Typography.SubHeading2>
            <Typography.Caption1 className="text-secondaryText">
              Enter a one-time code to unlock premium access instantly.
            </Typography.Caption1>
          </View>

          <Input
            label="Promo code"
            placeholder="Enter your code"
            value={promoCode}
            onChangeText={(text) => {
              setPromoCode(text.toUpperCase());
              if (promoError) setPromoError(undefined);
            }}
            errorText={promoError}
            inputProps={{
              autoCapitalize: "characters",
              autoCorrect: false,
              returnKeyType: "done",
              onSubmitEditing: () => {
                void onRedeemPromo();
              },
            }}
          />

          <Button
            title="Redeem code"
            variant="outlined"
            onPress={() => {
              void onRedeemPromo();
            }}
            loading={redeeming}
          />
        </View>

        {/* Legal */}
        <View className="flex-row justify-center gap-x-4">
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

        {/* Skip */}
        <Button title="Skip for now" variant="outlined" onPress={onSkip} />
      </ScrollView>
    </ScreenWrapper>
  );
};

export default SignupPaywallScreen;
