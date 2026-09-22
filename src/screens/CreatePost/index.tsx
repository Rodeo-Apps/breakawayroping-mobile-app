import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Dropdown,
  GooglePlacesInput,
  ScrollableTabs,
  SheetFormHeader,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/utils/toast";
import { emitHomeFeedRefresh } from "@/utils/feedEvents";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  T_CREATE_POST_FORM,
  T_CREATE_POST_SCHEMA,
  T_POST_TYPE,
  T_PRIVACY,
} from "./types";
import { uploadFeedPhoto } from "@/utils/postMediaUpload";
import { uploadVideo, validateVideoFile } from "@/utils/videoUpload";
import { trackInteraction, useTrackScreenFocus } from "@/analytics";

type T_RUN = {
  id: string;
  time_seconds: number;
  time_division?: string | null;
  run_date: string;
  horse_id?: string | null;
};

type T_HORSE = {
  id: string;
  name: string;
};

const CreatePost = () => {
  useTrackScreenFocus("create_post");
  const { profile } = useAuth();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const placeholderTextColor = useCSSVariable(
    "--color-placeholderText",
  ) as string;

  const [recentRuns, setRecentRuns] = useState<T_RUN[]>([]);
  const [horses, setHorses] = useState<T_HORSE[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [horsesLoading, setHorsesLoading] = useState(false);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [videoPickAsset, setVideoPickAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const previousPostType = useRef<T_POST_TYPE | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<T_CREATE_POST_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_CREATE_POST_SCHEMA),
    defaultValues: {
      content: "",
      postType: "text",
      privacy: "public",
      location: "",
      selectedRunId: "",
      selectedHorseId: "",
      localMediaUri: "",
    },
  });

  const postType = watch("postType");
  const privacy = watch("privacy");
  const selectedRunId = watch("selectedRunId");
  const selectedHorseId = watch("selectedHorseId");
  const localMediaUri = watch("localMediaUri");

  const selectedRun = useMemo(
    () => recentRuns.find((run) => run.id === selectedRunId) ?? null,
    [recentRuns, selectedRunId],
  );
  const selectedHorse = useMemo(
    () => horses.find((horse) => horse.id === selectedHorseId) ?? null,
    [horses, selectedHorseId],
  );

  const postTypeTabs = useMemo(
    () => [
      {
        label: "Text",
        value: "text",
        icon: "chatbubble-ellipses-outline" as const,
      },
      { label: "Photo", value: "photo", icon: "image-outline" as const },
      { label: "Video", value: "video", icon: "videocam-outline" as const },
      { label: "Share run", value: "run", icon: "timer-outline" as const },
      {
        label: "Achievement",
        value: "achievement",
        icon: "trophy-outline" as const,
      },
    ],
    [],
  );

  const privacyOptions = useMemo(
    () => [
      { label: "Public", value: "public" },
      { label: "Followers", value: "followers" },
      { label: "Private", value: "private" },
    ],
    [],
  );

  const runOptions = useMemo(
    () =>
      recentRuns.map((run) => ({
        label: `${run.time_seconds.toFixed(2)}s${
          run.time_division ? ` • ${run.time_division}` : ""
        }`,
        value: run.id,
      })),
    [recentRuns],
  );

  const horseOptions = useMemo(
    () => horses.map((horse) => ({ label: horse.name, value: horse.id })),
    [horses],
  );

  const loadRecentRuns = useCallback(async () => {
    if (!profile?.id) return;
    setRunsLoading(true);

    try {
      const { data, error } = await supabase
        .from("runs")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentRuns((data as T_RUN[]) || []);
    } catch (error) {
      console.error("Error loading runs:", error);
      setRecentRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [profile?.id]);

  const loadHorses = useCallback(async () => {
    if (!profile?.id) return;
    setHorsesLoading(true);

    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from("horses")
        .select("id, name")
        .eq("owner_id", profile.id);

      if (!ownerError) {
        setHorses((ownerData as T_HORSE[]) || []);
        return;
      }

      // Fallback for legacy schemas that still use user_id.
      const { data: legacyData, error: legacyError } = await supabase
        .from("horses")
        .select("id, name")
        .eq("user_id", profile.id as any);

      if (legacyError) throw legacyError;
      setHorses((legacyData as T_HORSE[]) || []);
    } catch (error) {
      console.error("Error loading horses:", error);
      setHorses([]);
    } finally {
      setHorsesLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadRecentRuns();
    void loadHorses();
  }, [loadHorses, loadRecentRuns]);

  useEffect(() => {
    if (postType !== "run" && selectedRunId) {
      setValue("selectedRunId", "", { shouldValidate: true });
    }
  }, [postType, selectedRunId, setValue]);

  useEffect(() => {
    if (previousPostType.current === null) {
      previousPostType.current = postType;
      return;
    }
    if (previousPostType.current === postType) return;
    previousPostType.current = postType;
    setValue("localMediaUri", "", { shouldValidate: true });
    setPhotoMimeType(null);
    setPhotoBase64(null);
    setVideoPickAsset(null);
  }, [postType, setValue]);

  const requestMediaLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Allow photo library access to attach media.", "warning");
      return false;
    }
    return true;
  }, []);

  const pickPhoto = useCallback(async () => {
    const ok = await requestMediaLibrary();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.75,
      base64: true,
      ...(Platform.OS === "ios"
        ? ({ preferredAssetRepresentationMode: "compatible" } as Record<
            string,
            unknown
          >)
        : {}),
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setVideoPickAsset(null);
    setPhotoMimeType(asset.mimeType ?? "image/jpeg");
    setPhotoBase64(asset.base64 ?? null);
    setValue("localMediaUri", asset.uri, { shouldValidate: true });
  }, [requestMediaLibrary, setValue]);

  const pickVideo = useCallback(async () => {
    const ok = await requestMediaLibrary();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const check = validateVideoFile(asset.uri);
    if (!check.valid) {
      showAlert(check.error || "Invalid video.", "error");
      return;
    }
    setPhotoMimeType(null);
    setPhotoBase64(null);
    setVideoPickAsset(asset);
    setValue("localMediaUri", asset.uri, { shouldValidate: true });
  }, [requestMediaLibrary, setValue]);

  const clearMedia = useCallback(() => {
    setValue("localMediaUri", "", { shouldValidate: true });
    setPhotoMimeType(null);
    setPhotoBase64(null);
    setVideoPickAsset(null);
  }, [setValue]);

  const handleCreatePost: SubmitHandler<T_CREATE_POST_FORM> = useCallback(
    async (formData) => {
      if (!profile?.id) return;
      try {
        const media_urls: string[] = [];

        if (formData.postType === "photo" && formData.localMediaUri.trim()) {
          const url = await uploadFeedPhoto(
            profile.id,
            formData.localMediaUri.trim(),
            photoMimeType,
            { base64: photoBase64 },
          );
          media_urls.push(url);
        } else if (
          formData.postType === "video" &&
          formData.localMediaUri.trim()
        ) {
          const v = validateVideoFile(formData.localMediaUri.trim());
          if (!v.valid) {
            showAlert(v.error || "Invalid video.", "error");
            return;
          }
          const asset = videoPickAsset;
          const uploaded = await uploadVideo(
            {
              uri: formData.localMediaUri.trim(),
              fileName: asset?.fileName ?? null,
              fileSize: asset?.fileSize ?? null,
              mimeType: asset?.mimeType ?? null,
              duration:
                typeof asset?.duration === "number" ? asset.duration : null,
            },
            profile.id,
          );
          media_urls.push(uploaded.url);
        }

        const payload: Record<string, unknown> = {
          user_id: profile.id,
          content: formData.content.trim(),
          post_type: formData.postType,
          privacy: formData.privacy,
          location: formData.location.trim() || null,
          media_urls,
        };

        if (formData.postType === "run" && selectedRun) {
          payload.run_id = selectedRun.id;
          payload.horse_id = selectedRun.horse_id ?? null;
        } else if (selectedHorse) {
          payload.horse_id = selectedHorse.id;
        }

        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw error;

        void trackInteraction("post_compose", "post_create", {
          post_type: formData.postType,
          has_run: formData.postType === "run" ? 1 : 0,
          has_media: media_urls.length > 0 ? 1 : 0,
        });

        emitHomeFeedRefresh();
        showAlert("Post created successfully!", "success");
        router.back();
      } catch (error: unknown) {
        showAlert(
          error instanceof Error && typeof error.message === "string"
            ? error.message
            : "Failed to create post. Please try again.",
          "error",
        );
      }
    },
    [photoBase64, photoMimeType, profile?.id, selectedHorse, selectedRun, videoPickAsset],
  );

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="Create Post"
        onClose={() => router.back()}
        primaryAction={{
          label: "Post",
          onPress: () => void handleSubmit(handleCreatePost)(),
          loading: isSubmitting,
        }}
      />

      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        bottomOffset={24}
        contentContainerClassName="px-5 py-6 pb-10 gap-y-4"
      >
        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Post type
          </Typography.SubHeading2>
          <ScrollableTabs
            className="rounded-2xl overflow-hidden border border-border"
            options={postTypeTabs}
            selected={postType}
            onChange={(value) =>
              setValue("postType", value as T_POST_TYPE, {
                shouldValidate: true,
              })
            }
          />
        </View>

        {postType === "photo" ? (
          <View className="gap-y-3">
            <Typography.SubHeading2 className="text-primaryText">
              Photo
            </Typography.SubHeading2>
            <Pressable
              onPress={() => void pickPhoto()}
              className="bg-background-secondary border border-border rounded-2xl p-4 flex-row items-center justify-between gap-x-3 active:opacity-90"
            >
              <View className="flex-row items-center gap-x-3">
                <Ionicons
                  name="image-outline"
                  size={22}
                  color={primaryTextColor}
                />
                <Typography.Body2 className="text-primaryText">
                  {localMediaUri ? "Change photo" : "Choose from library"}
                </Typography.Body2>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={primaryTextColor}
              />
            </Pressable>
            {localMediaUri ? (
              <View className="gap-y-2">
                <Image
                  source={{ uri: localMediaUri }}
                  className="w-full h-52 rounded-2xl bg-background-secondary"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={clearMedia}
                  className="self-start active:opacity-70"
                >
                  <Typography.Body2 className="text-danger font-poppins-medium">
                    Remove photo
                  </Typography.Body2>
                </Pressable>
              </View>
            ) : null}
            {errors.localMediaUri?.message ? (
              <Typography.Body2 className="text-danger">
                {errors.localMediaUri.message}
              </Typography.Body2>
            ) : null}
          </View>
        ) : null}

        {postType === "video" ? (
          <View className="gap-y-3">
            <Typography.SubHeading2 className="text-primaryText">
              Video
            </Typography.SubHeading2>
            <Pressable
              onPress={() => void pickVideo()}
              className="bg-background-secondary border border-border rounded-2xl p-4 flex-row items-center justify-between gap-x-3 active:opacity-90"
            >
              <View className="flex-row items-center gap-x-3">
                <Ionicons
                  name="videocam-outline"
                  size={22}
                  color={primaryTextColor}
                />
                <Typography.Body2 className="text-primaryText">
                  {localMediaUri ? "Change video" : "Choose from library"}
                </Typography.Body2>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={primaryTextColor}
              />
            </Pressable>
            {localMediaUri ? (
              <View className="gap-y-2">
                <View className="w-full h-52 rounded-2xl bg-black items-center justify-center overflow-hidden">
                  <Ionicons name="play-circle" size={56} color="#ffffff" />
                  <Typography.Caption1 className="text-white mt-2 px-4 text-center">
                    {videoPickAsset?.fileName || "Video selected"}
                  </Typography.Caption1>
                </View>
                <Pressable
                  onPress={clearMedia}
                  className="self-start active:opacity-70"
                >
                  <Typography.Body2 className="text-danger font-poppins-medium">
                    Remove video
                  </Typography.Body2>
                </Pressable>
              </View>
            ) : null}
            {errors.localMediaUri?.message ? (
              <Typography.Body2 className="text-danger">
                {errors.localMediaUri.message}
              </Typography.Body2>
            ) : null}
          </View>
        ) : null}

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            {postType === "photo" || postType === "video"
              ? "Caption (optional)"
              : "Content"}
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-3xl px-4 py-4 min-h-32">
            <Controller
              control={control}
              name="content"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  placeholder="What's on your mind?"
                  value={value}
                  onChangeText={onChange}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={placeholderTextColor}
                  className={`text-primaryText text-base min-h-24 ${value ? "font-oxygen-regular" : ""}`}
                />
              )}
            />
          </View>
          {errors.content?.message && (
            <Typography.Body2 className="text-danger">
              {errors.content.message}
            </Typography.Body2>
          )}
        </View>

        {postType === "run" && (
          <View className="gap-y-3">
            {runsLoading ? (
              <View className="h-14 bg-background-secondary rounded-full items-center justify-center">
                <ActivityIndicator size="small" color={primaryTextColor} />
              </View>
            ) : runOptions.length === 0 ? (
              <View className="bg-background-secondary rounded-2xl p-4 flex-row items-center gap-x-2">
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={primaryTextColor}
                />
                <Typography.Body2 className="text-secondaryText">
                  No recent runs found. Add a run first to share it.
                </Typography.Body2>
              </View>
            ) : (
              <Dropdown
                icon={
                  <Ionicons
                    name="timer-outline"
                    size={22}
                    color={primaryTextColor}
                  />
                }
                label="Select Run"
                placeholder="Choose a run"
                value={selectedRunId}
                onChangeValue={(value) =>
                  setValue("selectedRunId", value as string, {
                    shouldValidate: true,
                  })
                }
                options={runOptions}
              />
            )}
            {errors.selectedRunId?.message && (
              <Typography.Body2 className="text-danger">
                {errors.selectedRunId.message}
              </Typography.Body2>
            )}
          </View>
        )}

        {horsesLoading ? (
          <View className="h-14 bg-background-secondary rounded-full items-center justify-center">
            <ActivityIndicator size="small" color={primaryTextColor} />
          </View>
        ) : horseOptions.length === 0 ? (
          <View className="gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Tag Horse (Optional)
            </Typography.SubHeading2>
            <View className="bg-background-secondary rounded-2xl p-4 flex-row items-center gap-x-2">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={primaryTextColor}
              />
              <Typography.Body2 className="text-secondaryText flex-1">
                No horses found. Add a horse first to tag it in your post.
              </Typography.Body2>
            </View>
          </View>
        ) : (
          <Dropdown
            icon={
              <MaterialCommunityIcons
                name="horse"
                size={22}
                color={primaryTextColor}
              />
            }
            label="Tag Horse (Optional)"
            placeholder="Choose a horse"
            value={selectedHorseId}
            onChangeValue={(value) =>
              setValue("selectedHorseId", value as string, {
                shouldValidate: true,
              })
            }
            options={horseOptions}
          />
        )}

        <Controller
          control={control}
          name="location"
          render={({ field: { value, onChange } }) => (
            <GooglePlacesInput
              label="Location (Optional)"
              placeholder="Add location"
              value={value}
              onChangeValue={onChange}
            />
          )}
        />

        <Dropdown
          icon={<Feather name="globe" size={20} color={primaryTextColor} />}
          label="Privacy"
          value={privacy}
          onChangeValue={(value) =>
            setValue("privacy", value as T_PRIVACY, {
              shouldValidate: true,
            })
          }
          options={privacyOptions}
        />
      </KeyboardAwareScrollView>
    </View>
  );
};

export default CreatePost;
