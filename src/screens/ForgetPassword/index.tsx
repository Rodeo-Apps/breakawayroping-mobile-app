import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SubmitHandler, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

import { Button, Input, ScreenWrapper } from "@/components";
import InputController from "@/components/ui/InputController";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { showAlert } from "@/utils/toast";
import { T_FORGOT_PASSWORD_FORM, T_FORGOT_PASSWORD_SCHEMA } from "./types";

const ForgotPasswordScreen = () => {
  useTrackScreenFocus("forgot_password");
  const { requestPasswordReset } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const primaryText = useCSSVariable("--color-primaryText") as string;

  const getForgotPasswordErrorMessage = (error: unknown): string => {
    const rawMessage =
      typeof (error as { message?: unknown })?.message === "string"
        ? ((error as { message: string }).message ?? "")
        : "";
    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes("invalid email")) {
      return "Please enter a valid email address.";
    }

    if (normalizedMessage.includes("network request failed")) {
      return "Network error. Please check your internet connection and try again.";
    }

    if (normalizedMessage.includes("rate limit")) {
      return "Too many requests. Please wait a moment and try again.";
    }

    return rawMessage || "Unable to send OTP right now. Please try again.";
  };

  const {
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<T_FORGOT_PASSWORD_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_FORGOT_PASSWORD_SCHEMA),
    defaultValues: { email: "" },
  });

  const onSubmit: SubmitHandler<T_FORGOT_PASSWORD_FORM> = async (data) => {
    setIsSubmitting(true);
    const normalizedEmail = data.email.trim().toLowerCase();
    try {
      await requestPasswordReset(normalizedEmail);
      showAlert("OTP sent to your email.", "success");
      reset({ email: "" });
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email: normalizedEmail },
      });
    } catch (error: any) {
      showAlert(getForgotPasswordErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
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
            Forgot Password
          </Typography.Heading1>
          <Typography.SubHeading2 className="text-secondaryText">
            Enter your email and we will send a one-time password.
          </Typography.SubHeading2>
        </View>

        <View className="gap-y-4">
          <InputController
            control={control}
            name="email"
            renderInput={({ field: { value, onChange } }) => (
              <Input
                icon={<Feather name="mail" size={24} color={primaryText} />}
                label="Email"
                placeholder="Enter your email"
                value={value}
                onChangeText={onChange}
                errorText={errors.email?.message}
                inputProps={{
                  keyboardType: "email-address",
                  textContentType: "emailAddress",
                }}
              />
            )}
          />
        </View>

        <Button
          title="Send OTP"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Typography.SubHeading2 className="text-primaryText text-center">
            {`Remember your password? `}
            <Typography.SubHeading2 className="text-primary underline">
              Login
            </Typography.SubHeading2>
          </Typography.SubHeading2>
        </Pressable>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default ForgotPasswordScreen;
