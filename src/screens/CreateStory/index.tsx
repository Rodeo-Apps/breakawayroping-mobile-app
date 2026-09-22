import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

import { Input, SheetFormHeader, TopTabs } from "@/components";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { trackInteraction, useTrackScreenFocus } from "@/analytics";

const MEDIA_TABS = [
  { label: "Photo", value: "photo" },
  { label: "Video", value: "video" },
] as const;

const CreateStoryScreen = () => {
  useTrackScreenFocus("stories_create");
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const primaryText = useCSSVariable("--color-primaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;

  const leaveCreate = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(home)");
    }
  }, []);

  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [duration, setDuration] = useState("5");
  const [loading, setLoading] = useState(false);

  const tabOptions = useMemo(
    () => MEDIA_TABS.map((t) => ({ label: t.label, value: t.value })),
    [],
  );

  const onMediaTabChange = useCallback((value: string) => {
    setMediaType(value === "video" ? "video" : "photo");
  }, []);

  const handleCreateStory = useCallback(async () => {
    if (!profile?.id) {
      Alert.alert("Error", "You must be logged in to create a story");
      return;
    }

    if (!mediaUrl.trim()) {
      Alert.alert("Error", "Please enter a media URL");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("stories")
        .insert({
          user_id: profile.id,
          media_url: mediaUrl.trim(),
          media_type: mediaType,
          duration: parseInt(duration, 10) || 5,
        })
        .select();

      if (error) throw error;

      void trackInteraction("stories", "story_publish", {
        media_type: mediaType,
      });

      Alert.alert("Success", "Story posted successfully!", [
        { text: "OK", onPress: () => leaveCreate() },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to post story. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [duration, leaveCreate, mediaType, mediaUrl, profile?.id]);

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="Create story"
        onClose={leaveCreate}
        primaryAction={{
          label: "Share",
          onPress: handleCreateStory,
          loading,
          disabled: loading,
        }}
      />
      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        bottomOffset={24}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        }}
        contentContainerClassName="px-5 py-6 gap-y-6"
      >
        <View className="flex-row gap-x-3 p-4 rounded-2xl bg-background-secondary border border-border">
          <Ionicons name="information-circle" size={22} color={primaryColor} />
          <Text className="flex-1 text-sm font-oxygen-regular text-primaryText leading-5">
            Stories disappear after 24 hours. Share moments from your breakaway
            racing journey.
          </Text>
        </View>

        <View className="gap-y-2">
          <Text className="text-sm font-poppins-semibold text-primaryText">
            Media type
          </Text>
          <TopTabs
            options={tabOptions}
            selected={mediaType}
            onChange={onMediaTabChange}
          />
        </View>

        <Input
          label="Media URL"
          placeholder="https://example.com/image.jpg"
          value={mediaUrl}
          onChangeText={setMediaUrl}
          icon={
            <Ionicons
              name={mediaType === "photo" ? "image-outline" : "videocam-outline"}
              size={22}
              color={primaryText}
            />
          }
          inputProps={{
            keyboardType: "url",
            autoCorrect: false,
          }}
        />
        <Text className="-mt-4 text-sm font-oxygen-regular text-secondaryText">
          Enter a URL to your photo or video. You can switch to camera or
          gallery in a later update.
        </Text>

        <Input
          label="Duration (seconds)"
          placeholder="5"
          value={duration}
          onChangeText={setDuration}
          icon={<Ionicons name="timer-outline" size={22} color={primaryText} />}
          inputProps={{
            keyboardType: "number-pad",
          }}
        />
        <Text className="-mt-4 text-sm font-oxygen-regular text-secondaryText">
          How long should this story be shown? (typically 3–15 seconds.)
        </Text>

        {mediaUrl.trim() ? (
          <View className="gap-y-2">
            <Text className="text-sm font-poppins-semibold text-primaryText">
              Preview
            </Text>
            <View className="w-full aspect-9/16 rounded-2xl overflow-hidden bg-black border border-border">
              {mediaType === "photo" ? (
                <Image
                  source={{ uri: mediaUrl.trim() }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-background-tertionary">
                  <Ionicons name="play-circle" size={64} color={primaryColor} />
                  <Text className="mt-2 text-sm font-oxygen-regular text-secondaryText">
                    Video preview
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View className="p-4 rounded-2xl bg-background-secondary border border-border gap-y-2">
          <Text className="text-base font-poppins-semibold text-primaryText">
            Tips for great stories
          </Text>
          <Text className="text-sm font-oxygen-regular text-secondaryText leading-5">
            {[
              "• Share your best runs and moments",
              "• Show behind-the-scenes training",
              "• Highlight your horse\u2019s personality",
              "• Connect with other riders",
            ].join("\n")}
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default CreateStoryScreen;
