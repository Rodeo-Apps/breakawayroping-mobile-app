import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppRefreshControl, Avatar, Loader, ScreenWrapper, TopTabs } from "@/components";
import { useTrackScreenFocus } from "@/analytics";
import { Typography } from "@/utils/typography";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";
import FeedCard from "../TabsHome/components/FeedCard";
import StreakBadge from "./components/StreakBadge";
import { showAlert } from "@/utils/toast";
import { useProfileData } from "@/services/supabase/useProfileData";
import type { T_FEED_ITEM } from "@/services/supabase/types";
import {
  FEED_LIST_PERF,
  FeedViewabilityProvider,
  useFeedViewabilityController,
  usePrefetchFeedImages,
} from "@/hooks/useFeedViewability";

type T_MORE_TAB = "posts" | "bookmarked";

const feedKeyExtractor = (item: T_FEED_ITEM) => item.id;

const FeedItemSeparator = () => (
  <View className="h-[0.5px] bg-background-secondary w-full" />
);

const TabsProfileScreen = () => {
  useTrackScreenFocus("tabs_profile");
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<T_MORE_TAB>("posts");
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { store, viewabilityConfigCallbackPairs } =
    useFeedViewabilityController();

  const {
    loading,
    myPosts,
    bookmarkedPosts,
    profileName,
    profileBio,
    avatarUri,
    postsCount,
    followersCount,
    followingCount,
    error: profileDataError,
    refreshProfileData,
  } = useProfileData();

  const tabOptions = useMemo(
    () => [
      { label: "My Posts", value: "posts" },
      { label: "Bookmarked", value: "bookmarked" },
    ],
    [],
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshProfileData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfileData]);

  const onFeedReposted = useCallback(() => {
    void refreshProfileData();
  }, [refreshProfileData]);

  const pickImage = useCallback(async () => {
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
      setUploadingAvatar(true);
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

      await Promise.all([refreshProfile(), refreshProfileData()]);
      showAlert("Profile photo updated", "success");
    } catch (error: any) {
      showAlert(
        typeof error?.message === "string"
          ? error.message
          : "Failed to upload profile photo",
        "error",
      );
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile?.id, refreshProfile, refreshProfileData]);

  const data = activeTab === "posts" ? myPosts : bookmarkedPosts;
  usePrefetchFeedImages(data);

  useEffect(() => {
    store.reset();
  }, [activeTab, store]);

  const renderFeedCard = useCallback(
    ({ item }: ListRenderItemInfo<T_FEED_ITEM>) => (
      <FeedCard item={item} onReposted={onFeedReposted} />
    ),
    [onFeedReposted],
  );

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <View className="px-5 py-6 gap-y-4 pb-4">
        <View className="gap-y-3 bg-background-secondary rounded-xl p-4">
          <View className="flex-row items-center gap-x-3">
            <Pressable
              onPress={pickImage}
              className="relative"
              disabled={uploadingAvatar}
            >
              <Avatar
                uri={avatarUri}
                name={profileName}
                className="w-20 h-20"
              />
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary items-center justify-center border-2 border-background">
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={16} color="#fff" />
                )}
              </View>
            </Pressable>

            <View className="flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                {profileName}
              </Typography.SubHeading1>
              {!!profileBio && (
                <Typography.Body2 className="text-secondaryText">
                  {profileBio}
                </Typography.Body2>
              )}
              <Pressable onPress={() => router.push("/edit-profile")}>
                <Typography.Body2 className="text-primary underline">{`Edit Profile`}</Typography.Body2>
              </Pressable>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="items-center flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                {postsCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                posts
              </Typography.Caption1>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/(profile)/follow-list",
                  params: { kind: "followers" },
                })
              }
              className="items-center flex-1"
              accessibilityRole="button"
              accessibilityLabel="View followers"
            >
              <Typography.SubHeading1 className="text-primaryText">
                {followersCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                followers
              </Typography.Caption1>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/(profile)/follow-list",
                  params: { kind: "following" },
                })
              }
              className="items-center flex-1"
              accessibilityRole="button"
              accessibilityLabel="View following"
            >
              <Typography.SubHeading1 className="text-primaryText">
                {followingCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                following
              </Typography.Caption1>
            </Pressable>
          </View>
        </View>

        <StreakBadge userId={profile?.id} />
      </View>
      <View className="px-5">
        <TopTabs
          options={tabOptions}
          selected={activeTab}
          onChange={(value) => setActiveTab(value as T_MORE_TAB)}
        />
      </View>
      <FeedViewabilityProvider value={store}>
        <View className="flex-1">
          <FlatList
            data={data}
            keyExtractor={feedKeyExtractor}
            renderItem={renderFeedCard}
            ItemSeparatorComponent={FeedItemSeparator}
            showsVerticalScrollIndicator={false}
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
            refreshControl={
              <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            className="flex-1"
            contentContainerClassName="flex-grow pt-4 pb-56"
            initialNumToRender={FEED_LIST_PERF.initialNumToRender}
            maxToRenderPerBatch={FEED_LIST_PERF.maxToRenderPerBatch}
            windowSize={FEED_LIST_PERF.windowSize}
            updateCellsBatchingPeriod={FEED_LIST_PERF.updateCellsBatchingPeriod}
            removeClippedSubviews={FEED_LIST_PERF.removeClippedSubviews}
            ListEmptyComponent={
              loading ? (
                <Loader message="Loading posts..." />
              ) : (
                <View className="flex-1 items-center justify-center px-5">
                  <Typography.Body2 className="text-secondaryText text-center">
                    {profileDataError
                      ? profileDataError
                      : activeTab === "posts"
                        ? "You have not posted yet."
                        : "No bookmarked posts yet."}
                  </Typography.Body2>
                </View>
              )
            }
          />
        </View>
      </FeedViewabilityProvider>
    </ScreenWrapper>
  );
};

export default TabsProfileScreen;
