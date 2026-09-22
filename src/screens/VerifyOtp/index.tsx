import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";

import { Button, ScreenWrapper } from "@/components";
import OtpInput from "@/components/ui/OtpInput";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";

const RESEND_SECONDS = 30;

const VerifyOtpScreen = () => {
  useTrackScreenFocus("verify_otp");
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyPasswordResetOtp, requestPasswordReset } = useAuth();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length < 6) {
      showAlert("Please enter the complete 6-digit OTP.", "error");
      return;
    }
    setIsVerifying(true);
    try {
      await verifyPasswordResetOtp(email, otp);
      // PASSWORD_RECOVERY event in AuthProvider handles navigation to reset-password
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Invalid or expired OTP. Please try again.";
      showAlert(message, "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await requestPasswordReset(email);
      setCountdown(RESEND_SECONDS);
      setOtp("");
      showAlert("A new OTP has been sent to your email.", "success");
    } catch (error: any) {
      showAlert("Failed to resend OTP. Please try again.", "error");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAwareScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="px-5 py-6 gap-y-9"
      >
        <View className="gap-y-1">
          <Typography.Heading1 className="text-primaryText">
            Verify OTP
          </Typography.Heading1>
          <Typography.SubHeading2 className="text-secondaryText">
            {`Enter the 6-digit code sent to ${email}`}
          </Typography.SubHeading2>
        </View>

        <OtpInput value={otp} onChange={setOtp} />

        <Button
          title="Verify OTP"
          onPress={handleVerify}
          loading={isVerifying}
        />

        <View className="items-center">
          {countdown > 0 ? (
            <Typography.SubHeading2 className="text-secondaryText text-center">
              {`Resend OTP in ${countdown}s`}
            </Typography.SubHeading2>
          ) : (
            <Pressable onPress={handleResend} disabled={isResending}>
              <Typography.SubHeading2 className="text-primaryText text-center">
                {"Didn't receive it? "}
                <Typography.SubHeading2 className="text-primary underline">
                  Resend OTP
                </Typography.SubHeading2>
              </Typography.SubHeading2>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => router.replace("/(auth)/forgot-password")}>
          <Typography.SubHeading2 className="text-primary underline text-center">
            Back
          </Typography.SubHeading2>
        </Pressable>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default VerifyOtpScreen;
