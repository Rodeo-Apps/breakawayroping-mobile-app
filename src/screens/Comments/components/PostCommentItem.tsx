import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";
import moment from "moment";
import { Avatar } from "@/components";
import { Typography } from "@/utils/typography";
import { maskProfanity } from "@/utils/profanityFilter";
import { useAuth } from "@/provider/AuthProvider";
import type { T_POST_COMMENT_NODE } from "@/services/supabase/postCommentsTypes";

type T_PROPS = {
  comment: T_POST_COMMENT_NODE;
  depth: number;
  isLiked: boolean;
  isDisliked: boolean;
  onToggleLike: () => void;
  onToggleDislike: () => void;
  onReply: () => void;
};

const PostCommentItem: React.FC<T_PROPS> = ({
  comment,
  depth,
  isLiked,
  isDisliked,
  onToggleLike,
  onToggleDislike,
  onReply,
}) => {
  const { profile } = useAuth();
  const primaryText = useCSSVariable("--color-primaryText") as string;
  const primary = useCSSVariable("--color-primary") as string;
  const danger = useCSSVariable("--color-danger") as string;
  const indent = Math.min(depth * 14, 56);
  const isOwnComment =
    !!profile?.id && String(profile.id) === String(comment.user_id);

  const openCommentOptions = () => {
    router.push({
      pathname: "/content-moderation",
      params: {
        targetUserId: comment.user_id,
        contentType: "comment",
        contentId: comment.id,
        displayTitle: comment.profile.name || "Comment",
      },
    });
  };

  return (
    <View className="border-b border-border py-3" style={{ paddingLeft: indent }}>
      <View className="flex-row gap-x-3">
        <Avatar
          uri={comment.profile.avatar_url ?? undefined}
          name={comment.profile.name ?? undefined}
          className="w-10 h-10"
        />
        <View className="flex-1 gap-y-1">
          <View className="flex-row items-center flex-wrap gap-x-2">
            <Typography.SubHeading2 className="text-primaryText flex-1">
              {comment.profile.name || "Unknown"}
            </Typography.SubHeading2>
            <Typography.Caption1 className="text-secondaryText">
              {moment(comment.created_at).fromNow()}
            </Typography.Caption1>
            {!isOwnComment ? (
              <Pressable
                onPress={openCommentOptions}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Comment options"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={primaryText}
                />
              </Pressable>
            ) : null}
          </View>
          <Typography.Body2 className="text-primaryText">
            {maskProfanity(comment.content)}
          </Typography.Body2>

          <View className="flex-row items-center gap-x-4 pt-1 flex-wrap">
            <Pressable
              onPress={onToggleLike}
              className="flex-row items-center gap-x-1"
              accessibilityRole="button"
              accessibilityLabel="Like comment"
            >
              <Ionicons
                name={isLiked ? "thumbs-up" : "thumbs-up-outline"}
                size={18}
                color={isLiked ? primary : primaryText}
              />
              <Typography.Caption1 className={isLiked ? "text-primary" : "text-secondaryText"}>
                {comment.like_count}
              </Typography.Caption1>
            </Pressable>

            <Pressable
              onPress={onToggleDislike}
              className="flex-row items-center gap-x-1"
              accessibilityRole="button"
              accessibilityLabel="Dislike comment"
            >
              <Ionicons
                name={isDisliked ? "thumbs-down" : "thumbs-down-outline"}
                size={18}
                color={isDisliked ? danger : primaryText}
              />
              <Typography.Caption1 className={isDisliked ? "text-danger" : "text-secondaryText"}>
                {comment.dislike_count}
              </Typography.Caption1>
            </Pressable>

            <Pressable onPress={onReply} accessibilityRole="button" accessibilityLabel="Reply">
              <Typography.Caption1 className="text-primary font-poppins-semibold">Reply</Typography.Caption1>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PostCommentItem;
