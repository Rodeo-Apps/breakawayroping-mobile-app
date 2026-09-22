import { View, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { Button, Input, ScreenWrapper } from "@/components";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Typography } from "@/utils/typography";
import { SubmitHandler, useForm } from "react-hook-form";
import { T_LOGIN_FORM, T_LOGIN_SCHEMA } from "./types";
import { yupResolver } from "@hookform/resolvers/yup";
import InputController from "@/components/ui/InputController";
import { useCSSVariable } from "uniwind";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import { showAlert } from "@/utils/toast";

const LoginScreen = () => {
  useTrackScreenFocus("login");
  const { signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<T_LOGIN_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_LOGIN_SCHEMA),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const primaryText = useCSSVariable("--color-primaryText") as string;

  const onSubmit: SubmitHandler<T_LOGIN_FORM> = async (data) => {
    setIsSubmitting(true);
    try {
      await signIn(data.email.trim().toLowerCase(), data.password);

      reset({ email: "", password: "" });
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      const rawMessage =
        typeof error?.message === "string"
          ? error.message
          : "Unable to login. Please try again.";

      if (rawMessage.toLowerCase().includes("invalid login credentials")) {
        showAlert("Invalid email or password.", "error");
      } else {
        showAlert(rawMessage, "error");
      }
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
          <Typography.Heading1 className="text-primaryText">{`Login`}</Typography.Heading1>
          <Typography.SubHeading2 className="text-secondaryText">{`Enter your details to continue`}</Typography.SubHeading2>
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
          <InputController
            control={control}
            name="password"
            renderInput={({ field: { value, onChange } }) => (
              <Input
                icon={<Feather name="lock" size={24} color={primaryText} />}
                label="Password"
                placeholder="Enter your password"
                value={value}
                onChangeText={onChange}
                errorText={errors.password?.message}
                isPassword
                inputProps={{
                  keyboardType: "default",
                  textContentType: "password",
                }}
              />
            )}
          />
          <Pressable onPress={() => router.push("/forgot-password" as never)}>
            <Typography.SubHeading2 className="text-primary underline text-right">{`Forgot Password?`}</Typography.SubHeading2>
          </Pressable>
        </View>
        <Button
          title="Login"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <Pressable onPress={() => router.replace("/(auth)/signup")}>
          <Typography.SubHeading2 className="text-primaryText text-center">
            {`Don't have an account? `}
            <Typography.SubHeading2 className="text-primary underline">{`Sign Up`}</Typography.SubHeading2>
          </Typography.SubHeading2>
        </Pressable>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default LoginScreen;
