import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SubmitHandler, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, Dropdown, Input, ScreenWrapper } from "@/components";
import InputController from "@/components/ui/InputController";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { showAlert } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { T_EDIT_PROFILE_FORM, T_EDIT_PROFILE_SCHEMA } from "./types";
import { useUserRoles } from "@/services/supabase/useUserRoles";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTrackScreenFocus } from "@/analytics";

const EditProfileScreen = () => {
  useTrackScreenFocus("edit_profile");
  const { profile, user, refreshProfile } = useAuth();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const placeholderTextColor = useCSSVariable(
    "--color-placeholderText",
  ) as string;

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const { loadingRoles, roleOptions } = useUserRoles();

  const initialName = useMemo(
    () =>
      profile?.name ||
      (user?.user_metadata?.full_name as string) ||
      (user?.user_metadata?.name as string) ||
      "",
    [profile?.name, user?.user_metadata],
  );

  const initialBio = useMemo(() => (profile as any)?.bio || "", [profile]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<T_EDIT_PROFILE_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_EDIT_PROFILE_SCHEMA),
    defaultValues: {
      name: initialName,
      bio: initialBio,
        describesYou: [],
    },
  });

  useEffect(() => {
    reset({ name: initialName, bio: initialBio, describesYou: selectedRoleIds });
  }, [initialBio, initialName, reset, selectedRoleIds]);

  useEffect(() => {
    const loadSelectedRoles = async () => {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role_id")
          .eq("user_id", profile.id);
        if (error) throw error;
        setSelectedRoleIds((data ?? []).map((row: any) => row.role_id));
      } catch (error) {
        setSelectedRoleIds([]);
      }
    };

    void loadSelectedRoles();
  }, [profile?.id]);

  useEffect(() => {
    const rawAvatar = profile?.avatar_url ?? null;
    if (!rawAvatar) {
      setAvatarUri(null);
      return;
    }
    if (rawAvatar.startsWith("http://") || rawAvatar.startsWith("https://")) {
      setAvatarUri(rawAvatar);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(rawAvatar);
    setAvatarUri(data?.publicUrl || null);
  }, [profile?.avatar_url]);

  const pickAvatar = async () => {
    if (!profile?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Please allow photo library access", "warning");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setIsUploadingAvatar(true);
      const uri = result.assets[0].uri;
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.id}/avatar.${fileExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("id", profile.id);
      if (updateError) throw updateError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUri(data?.publicUrl || null);
      await refreshProfile();
      showAlert("Profile photo updated", "success");
    } catch (error: any) {
      showAlert(
        typeof error?.message === "string"
          ? error.message
          : "Failed to update profile photo",
        "error",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit: SubmitHandler<T_EDIT_PROFILE_FORM> = async (formData) => {
    if (!profile?.id) return;
    try {
      const updates: Record<string, unknown> = {
        name: formData.name.trim(),
        bio: formData.bio.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
      if (error) throw error;

      const { error: clearRolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", profile.id);
      if (clearRolesError) throw clearRolesError;

      if (formData.describesYou.length > 0) {
        const rows = formData.describesYou.map((roleId) => ({
          user_id: profile.id,
          role_id: roleId,
        }));
        const { error: insertRolesError } = await supabase
          .from("user_roles")
          .insert(rows);
        if (insertRolesError) throw insertRolesError;
      }

      await refreshProfile();
      showAlert("Profile updated", "success");
      router.back();
    } catch (error: any) {
      showAlert(
        typeof error?.message === "string"
          ? error.message
          : "Failed to update profile",
        "error",
      );
    }
  };

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <KeyboardAwareScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="px-5 py-6 gap-y-4 pb-10"
      >
        <View className="items-center gap-y-2">
          <Pressable onPress={pickAvatar} disabled={isUploadingAvatar}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                className="w-28 h-28 rounded-full"
              />
            ) : (
              <View className="w-28 h-28 rounded-full bg-background-secondary items-center justify-center">
                <Ionicons
                  name="person"
                  size={38}
                  color={placeholderTextColor}
                />
              </View>
            )}
            <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background">
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          <Typography.Caption1 className="text-secondaryText">
            Tap to change photo
          </Typography.Caption1>
        </View>

        <InputController
          control={control as any}
          name="name"
          renderInput={({ field: { value, onChange } }) => (
            <Input
              label="Name"
              placeholder="Your name"
              value={value}
              onChangeText={onChange}
              errorText={errors.name?.message}
            />
          )}
        />

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Bio
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-3xl px-4 py-2 min-h-28">
            <InputController
              control={control as any}
              name="bio"
              renderInput={({ field: { value, onChange } }) => (
                <TextInput
                  placeholder="Tell people about yourself..."
                  value={value}
                  onChangeText={onChange}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={placeholderTextColor}
                  className={`text-primaryText text-base min-h-20 ${value ? "font-oxygen-regular" : ""}`}
                />
              )}
            />
          </View>
        </View>

        <InputController
          control={control as any}
          name="describesYou"
          renderInput={({ field: { value, onChange } }) => (
            <Dropdown
              icon={<Feather name="users" size={22} color={primaryTextColor} />}
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
        <Button
          title="Save Changes"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default EditProfileScreen;
