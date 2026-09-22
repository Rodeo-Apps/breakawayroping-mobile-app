import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { deletePostWithMedia } from "@/services/supabase/deletePostWithMedia";
import { emitHomeFeedRefresh } from "@/utils/feedEvents";
import { showAlert } from "@/utils/toast";

const PostOptionsScreen = () => {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId =
    typeof params.postId === "string"
      ? params.postId
      : Array.isArray(params.postId)
        ? params.postId[0]
        : undefined;

  const dangerColor = useCSSVariable("--color-danger") as string;
  const [deleting, setDeleting] = useState(false);

  const runDelete = useCallback(async () => {
    if (!profile?.id || !postId) return;
    setDeleting(true);
    try {
      await deletePostWithMedia(postId, profile.id);
      emitHomeFeedRefresh();
      showAlert("Post deleted.", "success");
      router.back();
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Could not delete this post.";
      showAlert(msg, "error");
    } finally {
      setDeleting(false);
    }
  }, [postId, profile?.id]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete post?",
      "This removes the post, its media, likes, comments, and bookmarks. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void runDelete(),
        },
      ],
    );
  }, [runDelete]);

  if (!postId) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Post" onClose={() => router.back()} />
        <View className="px-5 py-6">
          <Typography.Body1 className="text-secondaryText">
            Missing post.
          </Typography.Body1>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 16 }}
    >
      <SheetFormHeader title="Post" onClose={() => router.back()} />
      <View className="px-5 py-6 gap-y-6">
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          className="flex-row items-center gap-x-3 rounded-2xl bg-background-secondary p-4 border border-border"
          accessibilityRole="button"
          accessibilityLabel="Delete post"
        >
          {deleting ? (
            <ActivityIndicator color={dangerColor} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={dangerColor} />
          )}
          <Typography.Body1 className="text-danger font-poppins-semibold flex-1">
            Delete post
          </Typography.Body1>
        </Pressable>
      </View>
    </View>
  );
};

export default PostOptionsScreen;
