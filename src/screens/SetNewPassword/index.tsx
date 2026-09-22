import React, { useEffect, useRef, useState } from "react";
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
import { T_RESET_PASSWORD_FORM, T_RESET_PASSWORD_SCHEMA } from "./types";

const ResetPasswordScreen = () => {
  useTrackScreenFocus("reset_password");
  const {
    updatePassword,
    session,
    loading,
    isPasswordRecovery,
    passwordRecoveryLinkStatus,
  } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasResetRef = useRef(false);
  const primaryText = useCSSVariable("--color-primaryText") as string;

  useEffect(() => {
    if (loading || passwordRecoveryLinkStatus === "processing" || hasResetRef.current) return;

    const canReset =
      Boolean(session) ||
      isPasswordRecovery ||
      passwordRecoveryLinkStatus === "success";

    if (!canReset) {
      showAlert(
        "This reset link is invalid or has expired. Request a new one.",
        "error",
      );
      router.replace("/(auth)/forgot-password");
    }
  }, [loading, session, isPasswordRecovery, passwordRecoveryLinkStatus]);

  const {
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<T_RESET_PASSWORD_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_RESET_PASSWORD_SCHEMA),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit: SubmitHandler<T_RESET_PASSWORD_FORM> = async (data) => {
    setIsSubmitting(true);
    try {
      await updatePassword(data.password);
      hasResetRef.current = true;
      showAlert("Password updated successfully.", "success");
      reset({ password: "", confirmPassword: "" });
      router.replace("/(auth)/login");
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Unable to reset password right now. Please try again.";
      showAlert(message, "error");
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
            Reset Password
          </Typography.Heading1>
          <Typography.SubHeading2 className="text-secondaryText">
            Set your new password and confirm it to continue.
          </Typography.SubHeading2>
        </View>

        <View className="gap-y-4">
          <InputController
            control={control}
            name="password"
            renderInput={({ field: { value, onChange } }) => (
              <Input
                icon={<Feather name="lock" size={24} color={primaryText} />}
                label="New Password"
                placeholder="Enter new password"
                value={value}
                onChangeText={onChange}
                errorText={errors.password?.message}
                isPassword
                inputProps={{
                  keyboardType: "default",
                  textContentType: "newPassword",
                }}
              />
            )}
          />

          <InputController
            control={control}
            name="confirmPassword"
            renderInput={({ field: { value, onChange } }) => (
              <Input
                icon={<Feather name="lock" size={24} color={primaryText} />}
                label="Confirm New Password"
                placeholder="Confirm new password"
                value={value}
                onChangeText={onChange}
                errorText={errors.confirmPassword?.message}
                isPassword
                inputProps={{
                  keyboardType: "default",
                  textContentType: "newPassword",
                }}
              />
            )}
          />
        </View>

        <Button
          title="Set New Password"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Typography.SubHeading2 className="text-primary underline text-center">
            Back to Login
          </Typography.SubHeading2>
        </Pressable>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default ResetPasswordScreen;
