import { View, Pressable } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Button, Dropdown, Input, ScreenWrapper } from "@/components";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Typography } from "@/utils/typography";
import { SubmitHandler, useForm } from "react-hook-form";
import { T_SIGNUP_SCHEMA, T_SINGUP_FORM } from "./types";
import { yupResolver } from "@hookform/resolvers/yup";
import InputController from "@/components/ui/InputController";
import LegalConsentCheckbox from "@/components/ui/LegalConsentCheckbox";
import { useCSSVariable } from "uniwind";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useUserRoles } from "@/services/supabase/useUserRoles";
import { useAuth } from "@/provider/AuthProvider";
import { useTrackScreenFocus } from "@/analytics";
import { showAlert } from "@/utils/toast";
import { supabase } from "@/lib/supabase";

type SchoolInfo = { id: string; name: string; type: string };

const SignupScreen = () => {
  useTrackScreenFocus("signup");
  const { signUp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [schoolCodeError, setSchoolCodeError] = useState("");
  const codeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    reset,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<T_SINGUP_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_SIGNUP_SCHEMA),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      describesYou: [],
      schoolCode: "",
      acceptedLegalTerms: false,
    },
  });

  const primaryText = useCSSVariable("--color-primaryText") as string;
  const { loadingRoles, roleOptions } = useUserRoles();
  const selectedRoles = watch("describesYou");
  const watchedSchoolCode = watch("schoolCode");

  useEffect(() => {
    if (selectedRoles?.length > 0) return;
    if (!roleOptions.length) return;
    const fanRole = roleOptions.find(
      (option) => option.key === "fan_spectator",
    );
    if (fanRole) {
      setValue("describesYou", [fanRole.id], { shouldValidate: true });
    }
  }, [roleOptions, selectedRoles, setValue]);

  useEffect(() => {
    const code = watchedSchoolCode?.trim().toUpperCase() ?? "";
    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);

    if (!code) {
      setSchoolInfo(null);
      setSchoolCodeError("");
      return;
    }

    codeDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("schools")
        .select("id, name, type")
        .eq("school_code", code)
        .maybeSingle();

      if (data) {
        setSchoolInfo(data as SchoolInfo);
        setSchoolCodeError("");
      } else {
        setSchoolInfo(null);
        setSchoolCodeError("No school found with this code.");
      }
    }, 500);

    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
  }, [watchedSchoolCode]);

  const getSignupErrorMessage = (error: unknown): string => {
    const rawMessage =
      typeof (error as { message?: unknown })?.message === "string"
        ? ((error as { message: string }).message ?? "")
        : "";
    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes("user already registered")) {
      return "This email is already registered. Please log in instead.";
    }

    if (
      normalizedMessage.includes("password") &&
      normalizedMessage.includes("at least")
    ) {
      return "Password is too weak. Please use at least 6 characters.";
    }

    if (
      normalizedMessage.includes("invalid email") ||
      normalizedMessage.includes("email")
    ) {
      return "Please enter a valid email address.";
    }

    if (normalizedMessage.includes("network request failed")) {
      return "Network error. Please check your internet connection and try again.";
    }

    return rawMessage || "Unable to sign up right now. Please try again.";
  };

  const onSubmit: SubmitHandler<T_SINGUP_FORM> = async (data) => {
    const code = data.schoolCode?.trim().toUpperCase() || undefined;
    if (code && !schoolInfo) {
      showAlert("The school code you entered is invalid. Please check it or leave it empty.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const { sessionCreated } = await signUp(
        data.email.trim().toLowerCase(),
        data.password,
        data.fullName.trim(),
        data.describesYou,
        code,
      );

      reset({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        describesYou: [],
        schoolCode: "",
        acceptedLegalTerms: false,
      });
      setSchoolInfo(null);
      setSchoolCodeError("");

      if (!sessionCreated) {
        // Email confirmation is required — send user to login
        showAlert(
          "Account created! Check your email to verify your account, then log in.",
          "success",
        );
        router.replace("/(auth)/login");
      }
      // If sessionCreated, the auth state change triggers the paywall via AuthLayout
    } catch (error) {
      showAlert(getSignupErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAwareScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="px-5 py-6 gap-y-9"
      >
        <View className="gap-y-1">
          <Typography.Heading1 className="text-primaryText">{`Create An Account`}</Typography.Heading1>
          <Typography.SubHeading2 className="text-secondaryText">{`Enter your details to continue`}</Typography.SubHeading2>
        </View>
        <View className="gap-y-4">
          <InputController
            control={control}
            name="fullName"
            renderInput={({ field: { value, onChange } }) => (
              <Input
                icon={<Feather name="user" size={24} color={primaryText} />}
                label="Name"
                placeholder="Enter your full name"
                value={value}
                onChangeText={onChange}
                errorText={errors.fullName?.message}
                inputProps={{
                  keyboardType: "default",
                  textContentType: "name",
                }}
              />
            )}
          />
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
                  textContentType: "newPassword",
                  keyboardType: "default",
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
                label="Confirm Password"
                placeholder="Confirm your password"
                value={value}
                onChangeText={onChange}
                errorText={errors.confirmPassword?.message}
                isPassword
                inputProps={{
                  textContentType: "newPassword",
                  keyboardType: "default",
                }}
              />
            )}
          />
          <InputController
            control={control}
            name="describesYou"
            renderInput={({ field: { value, onChange } }) => (
              <Dropdown
                icon={<Feather name="users" size={24} color={primaryText} />}
                label="Select what describes you"
                placeholder={
                  loadingRoles
                    ? "Loading role options..."
                    : "Choose one or more options"
                }
                value={value}
                onChangeValue={(next) => onChange(next as string[])}
                multiSelect
                options={roleOptions.map((option) => ({
                  label: option.label,
                  value: option.id,
                }))}
                errorText={errors.describesYou?.message as string | undefined}
              />
            )}
          />
          <InputController
            control={control}
            name="schoolCode"
            renderInput={({ field: { value, onChange } }) => (
              <View className="gap-y-1">
                <Input
                  icon={<Feather name="hash" size={24} color={primaryText} />}
                  label="School / College Code (Optional)"
                  placeholder="e.g. BC-A2KM7N"
                  value={value ?? ""}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  errorText={schoolCodeError || undefined}
                  inputProps={{
                    keyboardType: "default",
                    autoCapitalize: "characters",
                  }}
                />
                {schoolInfo && (
                  <View className="flex-row items-center gap-x-1.5 px-1">
                    <Feather name="check-circle" size={13} color="#16a34a" />
                    <Typography.Caption1 className="text-green-600">
                      {schoolInfo.name}
                    </Typography.Caption1>
                  </View>
                )}
              </View>
            )}
          />
        </View>

        <InputController
          control={control}
          name="acceptedLegalTerms"
          renderInput={({ field: { value, onChange } }) => (
            <LegalConsentCheckbox
              checked={Boolean(value)}
              onToggle={() => onChange(!value)}
              errorText={errors.acceptedLegalTerms?.message}
            />
          )}
        />

        <Button
          title="Sign Up"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Typography.SubHeading2 className="text-primaryText text-center">
            {`Already have an account? `}
            <Typography.SubHeading2 className="text-primary underline">{`Log In`}</Typography.SubHeading2>
          </Typography.SubHeading2>
        </Pressable>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default SignupScreen;
