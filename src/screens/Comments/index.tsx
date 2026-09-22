import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppRefreshControl,
  EmptyState,
  Input,
  Loader,
  RoundedIconButton,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import type { T_POST_COMMENT_NODE } from "@/services/supabase/postCommentsTypes";
import { usePostComments } from "@/services/supabase/usePostComments";
import { useBlockedUsersContext } from "@/provider/BlockedUsersProvider";
import { filterCommentTree } from "@/utils/blockFilter";
import { emitHomeFeedRefresh } from "@/utils/feedEvents";
import { useTrackScreenFocus } from "@/analytics";
import { showAlert } from "@/utils/toast";
import PostCommentItem from "./components/PostCommentItem";

function flattenComments(
  nodes: T_POST_COMMENT_NODE[],
  depth = 0,
): Array<{ node: T_POST_COMMENT_NODE; depth: number }> {
  const out: Array<{ node: T_POST_COMMENT_NODE; depth: number }> = [];
  nodes.forEach((node) => {
    out.push({ node, depth });
    if (node.replies?.length) {
      out.push(...flattenComments(node.replies, depth + 1));
    }
  });
  return out;
}

const CommentsScreen = () => {
  const { profile } = useAuth();
  const { postId: postIdParam } = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId =
    typeof postIdParam === "string" ? postIdParam : Array.isArray(postIdParam) ? postIdParam[0] : undefined;

  useTrackScreenFocus("comments", { post_id: postId ?? "" });

  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<T_POST_COMMENT_NODE | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const primaryColor = useCSSVariable("--color-primary") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const insets = useSafeAreaInsets();

  const { isHidden } = useBlockedUsersContext();

  const {
    comments,
    likedIds,
    dislikedIds,
    loading,
    submitting,
    error,
    submitComment,
    toggleLike,
    toggleDislike,
    refresh,
  } = usePostComments(postId, profile?.id);

  const filteredComments = useMemo(
    () => filterCommentTree(comments, isHidden),
    [comments, isHidden],
  );

  const rows = useMemo(
    () => flattenComments(filteredComments),
    [filteredComments],
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        emitHomeFeedRefresh();
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const send = async () => {
    if (!profile?.id) {
      showAlert("Sign in to comment.", "warning");
      return;
    }
    if (!text.trim()) return;
    try {
      await submitComment(text, replyingTo?.id ?? null);
      setText("");
      setReplyingTo(null);
      emitHomeFeedRefresh();
    } catch {
      showAlert("Could not post comment.", "error");
    }
  };

  if (!postId) {
    return (
      <ScreenWrapper>
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={28} color={secondaryTextColor} />}
          message="Missing post."
        />
      </ScreenWrapper>
    );
  }

  if (loading) {
    return <Loader message="Loading comments..." />;
  }

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={90}
      >
        {error ? (
          <View className="px-5 pt-4">
            <Typography.Body2 className="text-danger">{error}</Typography.Body2>
          </View>
        ) : null}

        <FlatList
          data={rows}
          keyExtractor={(item) => item.node.id}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-4"
          contentContainerStyle={rows.length === 0 ? { flexGrow: 1 } : undefined}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="chatbubble-outline" size={28} color={secondaryTextColor} />}
              message="No comments yet. Say something nice."
            />
          }
          renderItem={({ item }) => {
            const { node, depth } = item;
            return (
              <View className="px-5">
                <PostCommentItem
                  comment={node}
                  depth={depth}
                  isLiked={likedIds.has(node.id)}
                  isDisliked={dislikedIds.has(node.id)}
                  onToggleLike={() =>
                    void toggleLike(node.id, node.like_count, node.dislike_count).catch(() =>
                      showAlert("Could not update like.", "error"),
                    )
                  }
                  onToggleDislike={() =>
                    void toggleDislike(node.id, node.like_count, node.dislike_count).catch(() =>
                      showAlert("Could not update dislike.", "error"),
                    )
                  }
                  onReply={() => setReplyingTo(node)}
                />
              </View>
            );
          }}
        />

        <View
          className="px-5 pt-2 border-t border-border bg-background gap-y-2"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {replyingTo ? (
            <View className="flex-row items-center justify-between bg-background-secondary rounded-2xl px-3 py-2">
              <Typography.Caption1 className="text-secondaryText flex-1" textProps={{ numberOfLines: 1 }}>
                Replying to {replyingTo.profile.name || "comment"}
              </Typography.Caption1>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={secondaryTextColor} />
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row items-end gap-x-3">
            <View className="flex-1">
              <Input
                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                value={text}
                onChangeText={setText}
                inputProps={{ maxLength: 2000 }}
              />
            </View>
            <View className={!text.trim() || submitting ? "opacity-40" : ""}>
              <RoundedIconButton
                icon={
                  <Ionicons
                    name={submitting ? "hourglass-outline" : "send"}
                    size={20}
                    color="#fff"
                  />
                }
                onPress={() => {
                  if (text.trim() && !submitting) void send();
                }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default CommentsScreen;
