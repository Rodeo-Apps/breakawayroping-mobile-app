import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  View,
} from "react-native";
import {
  router,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  Avatar,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { usePublicUserProfile } from "@/services/supabase/usePublicUserProfile";
import type { T_FEED_ITEM } from "@/services/supabase/types";
import { useTrackScreenFocus } from "@/analytics";
import FeedCard from "../TabsHome/components/FeedCard";
import type { T_UserProfileSearchParams } from "./types";
import {
  FEED_LIST_PERF,
  FeedViewabilityProvider,
  useFeedViewabilityController,
  usePrefetchFeedImages,
} from "@/hooks/useFeedViewability";

const feedKeyExtractor = (item: T_FEED_ITEM) => item.id;

const FeedItemSeparator = () => (
  <View className="h-[0.5px] bg-background-secondary w-full" />
);

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const { profile: authProfile } = useAuth();
  const { userId: userIdParam } =
    useLocalSearchParams<T_UserProfileSearchParams>();
  const userId =
    typeof userIdParam === "string"
      ? userIdParam
      : Array.isArray(userIdParam)
        ? userIdParam[0]
        : undefined;

  useTrackScreenFocus("user_profile", { user_id: userId ?? "" });

  const primaryText = useCSSVariable("--color-primaryText") as string;

  const [refreshing, setRefreshing] = useState(false);
  const { store, viewabilityConfigCallbackPairs } =
    useFeedViewabilityController();

  const {
    loading,
    profile,
    avatarUri,
    posts,
    postsCount,
    followersCount,
    followingCount,
    isFollowing,
    followUpdating,
    toggleFollow,
    error,
    refresh,
    viewerId,
    isUserHidden,
    isBlockedByMe,
  } = usePublicUserProfile(userId);

  usePrefetchFeedImages(posts);

  const isSelf = !!(userId && authProfile?.id === userId);

  useEffect(() => {
    if (isSelf) {
      router.replace("/(tabs)/(profile)");
    }
  }, [isSelf]);

  const displayName =
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "Profile";

  const openProfileOptions = useCallback(() => {
    if (!userId) return;
    Alert.alert(displayName, undefined, [
      {
        text: "Report",
        onPress: () =>
          router.push({
            pathname: "/content-moderation",
            params: {
              targetUserId: userId,
              contentType: "user",
              displayTitle: displayName,
            },
          }),
      },
      {
        text: isBlockedByMe ? "Unblock" : "Block",
        style: isBlockedByMe ? "default" : "destructive",
        onPress: () =>
          router.push({
            pathname: "/content-moderation",
            params: {
              targetUserId: userId,
              contentType: "user",
              displayTitle: displayName,
            },
          }),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [displayName, isBlockedByMe, userId]);

  useLayoutEffect(() => {
    const showActions = !!(viewerId && userId && viewerId !== userId);
    navigation.setOptions({
      headerTitle: loading && !profile ? "Profile" : displayName,
      headerRight: showActions
        ? () => (
            <View className="flex-row items-center gap-x-1">
              {!isUserHidden ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/messages/chat",
                      params: { userId: userId! },
                    })
                  }
                  hitSlop={12}
                  style={{ marginRight: 4 }}
                  accessibilityLabel="Message user"
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={22}
                    color={primaryText}
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openProfileOptions}
                hitSlop={12}
                style={{ marginRight: 4 }}
                accessibilityLabel="Profile options"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={primaryText}
                />
              </Pressable>
            </View>
          )
        : undefined,
    });
  }, [
    navigation,
    loading,
    profile,
    displayName,
    viewerId,
    userId,
    primaryText,
    isUserHidden,
    openProfileOptions,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T_FEED_ITEM>) => <FeedCard item={item} />,
    [],
  );

  const listHeader = useCallback(() => {
    if (!profile) return null;
    return (
      <View className="gap-y-6 pb-4">
        <View className="bg-background-secondary p-4 rounded-2xl gap-y-3">
          <View className="flex-row items-start gap-x-3">
            <Avatar
              uri={avatarUri}
              name={profile.name ?? profile.username ?? undefined}
              className="w-20 h-20"
            />
            <View className="flex-1 gap-y-1">
              <Typography.SubHeading1 className="text-primaryText">
                {profile.name || profile.username || "Member"}
              </Typography.SubHeading1>
              {!!profile.username && (
                <Typography.Body2 className="text-secondaryText">
                  {`@${profile.username}`}
                </Typography.Body2>
              )}
              {!!profile.bio && (
                <Typography.Body2 className="text-primaryText">
                  {profile.bio}
                </Typography.Body2>
              )}
            </View>
          </View>

          <View className="flex-row items-center justify-between gap-x-3">
            <View className="items-center flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                {postsCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                posts
              </Typography.Caption1>
            </View>
            <View className="items-center flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                {followersCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                followers
              </Typography.Caption1>
            </View>
            <View className="items-center flex-1">
              <Typography.SubHeading1 className="text-primaryText">
                {followingCount}
              </Typography.SubHeading1>
              <Typography.Caption1 className="text-secondaryText">
                following
              </Typography.Caption1>
            </View>
          </View>

          {isUserHidden ? (
            <View className="bg-background rounded-xl p-3 gap-y-2">
              <Typography.Body2 className="text-secondaryText">
                {isBlockedByMe
                  ? "You blocked this account. Their posts and messages are hidden."
                  : "This profile is not available."}
              </Typography.Body2>
              {isBlockedByMe ? (
                <Pressable
                  onPress={openProfileOptions}
                  className="py-2"
                  accessibilityRole="button"
                >
                  <Typography.Body2 className="text-primary font-poppins-semibold">
                    Manage block
                  </Typography.Body2>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {viewerId && userId && viewerId !== userId && !isUserHidden ? (
            <View className="flex-row items-center gap-x-3">
              <Pressable
                onPress={() => void toggleFollow()}
                disabled={followUpdating}
                className={`flex-1 items-center justify-center py-3 rounded-full border border-primary ${isFollowing ? "bg-transparent" : "bg-primary"}`}
              >
                {followUpdating ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? primaryText : "#fff"}
                  />
                ) : (
                  <Typography.Body2
                    className={
                      isFollowing ? "text-primaryText" : "text-onPrimary"
                    }
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Typography.Body2>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <Typography.SubHeading1 className="text-primaryText px-0">
          Posts
        </Typography.SubHeading1>
      </View>
    );
  }, [
    profile,
    avatarUri,
    postsCount,
    followersCount,
    followingCount,
    viewerId,
    userId,
    isFollowing,
    followUpdating,
    toggleFollow,
    primaryText,
    isUserHidden,
    isBlockedByMe,
    openProfileOptions,
  ]);

  if (isSelf) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="small" color={primaryText} />
      </View>
    );
  }

  if (!userId) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center px-5">
          <Typography.Body1 className="text-secondaryText text-center">
            Missing profile link.
          </Typography.Body1>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading && !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="small" color={primaryText} />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center px-5 py-6">
          <Typography.Body1 className="text-secondaryText text-center">
            {error}
          </Typography.Body1>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withoutBPadding withoutTPadding>
      <FeedViewabilityProvider value={store}>
        <FlatList
          data={posts}
          keyExtractor={feedKeyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={FeedItemSeparator}
          ListEmptyComponent={
            <View className="px-5 py-6 items-center">
              <Typography.Body2 className="text-secondaryText">
                No posts yet.
              </Typography.Body2>
            </View>
          }
          showsVerticalScrollIndicator={false}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="px-5 py-6 pb-56"
          initialNumToRender={FEED_LIST_PERF.initialNumToRender}
          maxToRenderPerBatch={FEED_LIST_PERF.maxToRenderPerBatch}
          windowSize={FEED_LIST_PERF.windowSize}
          updateCellsBatchingPeriod={FEED_LIST_PERF.updateCellsBatchingPeriod}
          removeClippedSubviews={FEED_LIST_PERF.removeClippedSubviews}
        />
      </FeedViewabilityProvider>
    </ScreenWrapper>
  );
};

export default UserProfileScreen;
