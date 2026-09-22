import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { ScreenWrapper } from "@/components";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import { usePromoCode } from "@/services/supabase/usePromoCode";
import {
  hasActivePromoAccess,
  hasLifetimeAccess,
} from "@/utils/premiumEntitlement";

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const PromoCodeScreen = () => {
  useTrackScreenFocus("promo_code");
  const { profile } = useAuth();
  const { redeemPromoCode, redeeming } = usePromoCode();
  const [code, setCode] = useState("");
  const [errorText, setErrorText] = useState<string | undefined>();

  const onRedeem = async () => {
    setErrorText(undefined);
    const result = await redeemPromoCode(code);

    if (result.success) {
      setCode("");
      Alert.alert(
        result.isLifetime ? "Lifetime access activated" : "Promo code redeemed",
        result.isLifetime
          ? "You now have lifetime access to all premium features."
          : `Your premium access is active until ${formatDate(result.expiresAt)}.`,
      );
      return;
    }

    setErrorText(result.message);
  };

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <ScrollView
        contentContainerClassName="px-5 py-6 gap-y-6 pb-10"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-y-2">
          <Typography.SubHeading1 className="text-primaryText">
            Redeem promo code
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText">
            Enter a one-time promo code to unlock all premium features for a
            limited time or lifetime.
          </Typography.Body2>
        </View>

        {hasLifetimeAccess(profile) ? (
          <View className="bg-background rounded-2xl p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Lifetime access
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              You already have lifetime access to all premium features.
            </Typography.Body2>
          </View>
        ) : hasActivePromoAccess(profile) ? (
          <View className="bg-background rounded-2xl p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Promo access active
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              Your promo access is active until{" "}
              {formatDate(profile?.promo_expires_at)}.
            </Typography.Body2>
          </View>
        ) : (
          <>
            <Input
              label="Promo code"
              placeholder="Enter your code"
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                if (errorText) {
                  setErrorText(undefined);
                }
              }}
              errorText={errorText}
              inputProps={{
                autoCapitalize: "characters",
                autoCorrect: false,
                returnKeyType: "done",
                onSubmitEditing: () => {
                  void onRedeem();
                },
              }}
            />

            <Button
              title="Redeem code"
              onPress={() => {
                void onRedeem();
              }}
              loading={redeeming}
            />
          </>
        )}

        <View className="bg-background-secondary rounded-2xl p-4 gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            How it works
          </Typography.SubHeading2>
          <Typography.Body2 className="text-secondaryText">
            Each promo code can only be used once. After redemption, premium
            access is applied immediately and expires automatically when the
            period ends.
          </Typography.Body2>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default PromoCodeScreen;
