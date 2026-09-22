import { Pressable, View } from "react-native";
import React, { memo, useCallback } from "react";
import { router } from "expo-router";
import { T_FEED_ITEM } from "@/services/supabase/types";
import { Avatar } from "@/components";
import { Typography } from "@/utils/typography";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import Horse from "./Horse";
import TimeRun from "./TimeRun";
import moment from "moment";
import { useAuth } from "@/provider/AuthProvider";
import { usePostSocialActions } from "@/services/supabase/usePostSocialActions";
import FeedPostImage from "@/components/ui/FeedPostImage";
import ExpandableText from "@/components/ui/ExpandableText";
import FeedInlineVideo, { FEED_VIDEO_HEIGHT } from "./FeedInlineVideo";

type FeedCardProps = {
  item: T_FEED_ITEM;
  /** e.g. refresh profile “My posts” after repost when card is used outside the home feed */
  onReposted?: () => void;
};

function feedCardPropsEqual(prev: FeedCardProps, next: FeedCardProps): boolean {
  if (prev.onReposted !== next.onReposted) return false;
  const a = prev.item;
  const b = next.item;
  return (
    a.id === b.id &&
    a.like_count === b.like_count &&
    a.comment_count === b.comment_count &&
    a.repost_count === b.repost_count &&
    a.content === b.content &&
    a.is_shared === b.is_shared &&
    a.location === b.location &&
    a.horse_id === b.horse_id &&
    a.run_id === b.run_id &&
    a.media_urls?.[0] === b.media_urls?.[0] &&
    a.post_type === b.post_type &&
    a.liked_by_me === b.liked_by_me &&
    a.bookmarked_by_me === b.bookmarked_by_me &&
    a.profiles?.name === b.profiles?.name &&
    a.profiles?.avatar_url === b.profiles?.avatar_url &&
    a.shared_post?.id === b.shared_post?.id &&
    a.shared_post?.media_urls?.[0] === b.shared_post?.media_urls?.[0] &&
    a.shared_post?.post_type === b.shared_post?.post_type
  );
}

const FeedCard: React.FC<FeedCardProps> = ({ item, onReposted }) => {
  const { profile } = useAuth();
  const primaryText = useCSSVariable("--color-primaryText") as string;
  const secondaryText = useCSSVariable("--color-secondaryText") as string;

  const {
    dangerColor,
    isLiked,
    likeCount,
    handleToggleLike,
    isBookmarked,
    handleToggleBookmark,
    commentCount,
    repostCount,
    isUpdatingRepost,
    handleRepost,
  } = usePostSocialActions({ item, onReposted });

  const goToProfile = useCallback(
    (targetUserId: string | undefined) => {
      if (!targetUserId) return;
      if (profile?.id === targetUserId) {
        router.push("/(tabs)/(profile)");
        return;
      }
      router.push(`/user/${targetUserId}`);
    },
    [profile?.id],
  );

  const openFullPhoto = useCallback((url: string) => {
    router.push({
      pathname: "/feed-photo",
      params: { uri: encodeURIComponent(url) },
    });
  }, []);

  const sharedPhotoUri = item.shared_post?.media_urls?.[0];
  const openSharedPhoto = useCallback(() => {
    if (!sharedPhotoUri) return;
    openFullPhoto(sharedPhotoUri);
  }, [openFullPhoto, sharedPhotoUri]);

  const postPhotoUri = item.media_urls?.[0];
  const openPostPhoto = useCallback(() => {
    if (!postPhotoUri) return;
    openFullPhoto(postPhotoUri);
  }, [openFullPhoto, postPhotoUri]);

  const openComments = useCallback(() => {
    router.push(`/comments/${item.id}`);
  }, [item.id]);

  const isOwnPost =
    !!profile?.id &&
    !!item.user_id &&
    String(profile.id) === String(item.user_id);

  const openPostOptions = useCallback(() => {
    router.push({
      pathname: "/post-options",
      params: { postId: item.id },
    });
  }, [item.id]);

  const openContentModeration = useCallback(() => {
    const targetUserId = item.user_id;
    if (!targetUserId) return;
    router.push({
      pathname: "/content-moderation",
      params: {
        targetUserId,
        contentType: "post",
        contentId: item.id,
        displayTitle: item.profiles?.name || "Post",
      },
    });
  }, [item.id, item.profiles?.name, item.user_id]);

  const goToAuthorProfile = useCallback(() => {
    goToProfile(item.user_id);
  }, [goToProfile, item.user_id]);

  const goToSharedAuthorProfile = useCallback(() => {
    goToProfile(item.shared_post?.user_id);
  }, [goToProfile, item.shared_post?.user_id]);

  const isRepostWithEmbed = item.is_shared && !!item.shared_post;
  const isSharedFallback = item.is_shared && !item.shared_post;

  return (
    <View className="rounded-xl overflow-hidden gap-y-4">
      {isRepostWithEmbed && item.shared_post ? (
        <>
          <View className="flex-row items-center gap-x-2 px-4 pt-4">
            <Ionicons name="repeat" size={16} color={secondaryText} />
            <View className="flex-1 flex-row items-center flex-wrap gap-x-2 min-w-0">
              <Pressable
                onPress={goToAuthorProfile}
                disabled={!item.user_id}
                accessibilityRole="button"
                accessibilityLabel="View profile"
              >
                <Typography.Body2 className="text-primaryText font-poppins-semibold">
                  {item.profiles.name || "Someone"}
                </Typography.Body2>
              </Pressable>
              <Typography.Body2 className="text-secondaryText">
                reposted
              </Typography.Body2>
            </View>
            <Pressable
              onPress={isOwnPost ? openPostOptions : openContentModeration}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Post options"
              className="p-1"
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={primaryText}
              />
            </Pressable>
          </View>

          <View className="rounded-xl border border-border bg-background mx-4 p-3 gap-y-2">
            <Pressable
              onPress={goToSharedAuthorProfile}
              disabled={!item.shared_post.user_id}
              className="flex-row items-start gap-x-3"
              accessibilityRole="button"
              accessibilityLabel="View original author profile"
            >
              <Avatar
                uri={item.shared_post.profiles.avatar_url ?? undefined}
                name={item.shared_post.profiles.name ?? undefined}
                className="w-10 h-10"
              />
              <View className="flex-1 gap-y-0.5">
                <Typography.Body1 className="text-primaryText font-poppins-semibold">
                  {item.shared_post.profiles.name || "Unknown"}
                </Typography.Body1>
                {item.shared_post.location ? (
                  <View className="flex-row items-center gap-x-1">
                    <Feather name="map-pin" size={12} color={secondaryText} />
                    <Typography.Caption1 className="text-secondaryText">
                      {item.shared_post.location}
                    </Typography.Caption1>
                  </View>
                ) : null}
                <Typography.Caption1 className="text-secondaryText">
                  {moment(item.shared_post.created_at).fromNow()}
                </Typography.Caption1>
              </View>
            </Pressable>
            {!!item.shared_post.content && (
              <ExpandableText
                text={item.shared_post.content}
                collapsedLines={4}
                showMoreLabel="Show more"
                showLessLabel="Show less"
                className="text-primaryText"
              />
            )}
            {item.shared_post.media_urls?.length ? (
              item.shared_post.post_type === "video" ? (
                <FeedInlineVideo
                  uri={item.shared_post.media_urls[0]}
                  viewabilityId={item.id}
                  postId={item.shared_post.id}
                  height={FEED_VIDEO_HEIGHT}
                />
              ) : (
                <FeedPostImage
                  uri={item.shared_post.media_urls[0]}
                  onPress={openSharedPhoto}
                />
              )
            ) : null}
            {!!item.shared_post.horse_id && (
              <Horse id={item.shared_post.horse_id} />
            )}
            {!!item.shared_post.run_id && (
              <TimeRun id={item.shared_post.run_id} />
            )}
          </View>
        </>
      ) : (
        <>
          <View className="flex-row items-center gap-x-3 px-4 pt-4">
            <Pressable
              onPress={goToAuthorProfile}
              disabled={!item.user_id}
              className="flex-1 flex-row items-center gap-x-3 min-w-0"
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              <Avatar
                uri={item.profiles.avatar_url}
                name={item.profiles.name}
              />
              <View className="flex-1 min-w-0">
                {isSharedFallback ? (
                  <View className="flex-row items-center gap-x-2 flex-wrap">
                    <Ionicons name="repeat" size={14} color={secondaryText} />
                    <Typography.Body1 className="text-primaryText font-poppins-semibold">
                      {item.profiles.name}
                    </Typography.Body1>
                    <Typography.Caption1 className="text-secondaryText">
                      · repost
                    </Typography.Caption1>
                  </View>
                ) : (
                  <Typography.Body1>{item.profiles.name}</Typography.Body1>
                )}
                {item.location && (
                  <View className="flex-row items-center gap-x-1">
                    <Feather name="map-pin" size={12} color={secondaryText} />
                    <Typography.Caption1 className="text-secondaryText">
                      {item.location}
                    </Typography.Caption1>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable
              onPress={isOwnPost ? openPostOptions : openContentModeration}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Post options"
              className="p-1"
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={primaryText}
              />
            </Pressable>
          </View>

          <View className="gap-y-3">
            {!!item.content && (
              <View className="px-4">
                <ExpandableText
                  text={item.content}
                  collapsedLines={4}
                  showMoreLabel="Show more"
                  showLessLabel="Show less"
                  className="text-primaryText"
                />
              </View>
            )}
            {item.media_urls?.[0] ? (
              <View className="w-full bg-background-secondary">
                {item.post_type === "video" ? (
                  <FeedInlineVideo
                    uri={item.media_urls[0]}
                    viewabilityId={item.id}
                    postId={item.id}
                    height={FEED_VIDEO_HEIGHT}
                  />
                ) : (
                  <FeedPostImage
                    uri={item.media_urls[0]}
                    onPress={openPostPhoto}
                  />
                )}
              </View>
            ) : null}
            {!!item.horse_id && (
              <View className="px-4">
                <Horse id={item.horse_id} />
              </View>
            )}
            {!!item.run_id && (
              <View className="px-4">
                <TimeRun id={item.run_id} />
              </View>
            )}
          </View>
        </>
      )}

      <View className="flex-row items-center justify-between gap-x-3 px-4">
        <View className="flex-row items-center gap-x-3">
          <Pressable
            onPress={handleToggleLike}
            className="flex-row items-center gap-x-1"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? dangerColor : primaryText}
            />
            <Typography.Body2 className="text-primaryText">
              {likeCount}
            </Typography.Body2>
          </Pressable>
          <Pressable
            onPress={openComments}
            className="flex-row items-center gap-x-1"
            accessibilityRole="button"
            accessibilityLabel="View comments"
          >
            <Ionicons name="chatbox-outline" size={20} color={primaryText} />
            <Typography.Body2 className="text-primaryText">
              {commentCount}
            </Typography.Body2>
          </Pressable>

          <Pressable
            onPress={() => void handleRepost()}
            className="flex-row items-center gap-x-1"
            accessibilityRole="button"
            accessibilityLabel="Repost"
            disabled={isUpdatingRepost}
          >
            <Ionicons
              name={isUpdatingRepost ? "hourglass-outline" : "repeat-outline"}
              size={20}
              color={primaryText}
            />
            <Typography.Body2 className="text-primaryText">
              {repostCount}
            </Typography.Body2>
          </Pressable>
        </View>
        <Pressable onPress={handleToggleBookmark}>
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={20}
            color={primaryText}
          />
        </Pressable>
      </View>

      <Typography.Caption1 className="text-secondaryText px-4 pb-4">
        {isRepostWithEmbed
          ? `Reposted ${moment(item.created_at).fromNow()}`
          : moment(item.created_at).fromNow()}
      </Typography.Caption1>
    </View>
  );
};

FeedCard.displayName = "FeedCard";

export default memo(FeedCard, feedCardPropsEqual);
