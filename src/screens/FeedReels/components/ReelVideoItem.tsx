import React, { memo, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Avatar } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { usePostSocialActions } from "@/services/supabase/usePostSocialActions";
import type { T_FEED_ITEM } from "@/services/supabase/types";

const LOADER_FALLBACK_MS = 10000;

const ReelVideoItemInner = memo(function ReelVideoItemInner({
  item,
  isActive,
  height,
}: {
  item: T_FEED_ITEM;
  isActive: boolean;
  height: number;
}) {
  const { profile } = useAuth();
  const uri = item.media_urls?.[0];
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const primaryColor = useCSSVariable("--color-primary") as string;

  const {
    dangerColor: dColor,
    isLiked,
    likeCount,
    handleToggleLike,
    isBookmarked,
    handleToggleBookmark,
    commentCount,
    repostCount,
    isUpdatingRepost,
    handleRepost,
  } = usePostSocialActions({ item });

  const player = useVideoPlayer(uri ?? "", (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    setVideoReady(false);
  }, [item.id, uri]);

  useEffect(() => {
    if (!player || !uri) return;

    if (player.status === "readyToPlay" || player.status === "error") {
      setVideoReady(true);
    }

    const sub = player.addListener(
      "statusChange",
      ({ status }: { status: string }) => {
        if (status === "readyToPlay" || status === "error") {
          setVideoReady(true);
        }
      },
    );

    return () => sub.remove();
  }, [player, uri]);

  useEffect(() => {
    if (!uri || videoReady) return;
    const t = setTimeout(() => setVideoReady(true), LOADER_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [uri, item.id, videoReady]);

  useEffect(() => {
    if (!player || !uri) return;
    player.muted = muted;
  }, [muted, player, uri]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  /** Autoplay as soon as the clip is ready while this reel is visible. */
  useEffect(() => {
    if (!player || !videoReady || !isActive) return;
    player.play();
  }, [player, videoReady, isActive]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player]);

  const goToProfile = () => {
    if (!item.user_id) return;
    if (profile?.id === item.user_id) {
      router.push("/(tabs)/(profile)");
      return;
    }
    router.push(`/user/${item.user_id}`);
  };

  if (!uri) {
    return <View style={{ height }} className="bg-black" />;
  }

  return (
    <View style={{ height }} className="bg-black">
      <VideoView
        style={{
          width: "100%",
          height: "100%",
          opacity: videoReady ? 1 : 0,
        }}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />

      {!videoReady ? (
        <View
          className="absolute inset-0 z-5 items-center justify-center bg-black"
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : null}

      <Pressable
        onPress={togglePlayPause}
        className="absolute inset-0 z-8"
        accessibilityRole="button"
        accessibilityLabel="Play or pause video"
      />

      <Pressable
        onPress={() => setMuted((m) => !m)}
        className="absolute top-14 right-4 z-30 w-11 h-11 rounded-full bg-black/45 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={muted ? "Unmute" : "Mute"}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-high"}
          size={22}
          color="#fff"
        />
      </Pressable>

      <Pressable
        onPress={goToProfile}
        className="absolute left-4 right-24 bottom-28 z-20 flex-row items-end gap-x-3"
        accessibilityRole="button"
        accessibilityLabel="View profile"
      >
        <Avatar
          uri={item.profiles.avatar_url}
          name={item.profiles.name}
          className="w-11 h-11"
        />
        <View className="flex-1 min-w-0 gap-y-1">
          <Typography.Body1 className="text-white font-poppins-semibold">
            {item.profiles.name || "Member"}
          </Typography.Body1>
          {!!item.content && (
            <Typography.Body2 className="text-white/90" textProps={{ numberOfLines: 3 }}>
              {item.content}
            </Typography.Body2>
          )}
        </View>
      </Pressable>

      <View className="absolute right-3 bottom-32 z-20 gap-y-5 items-center">
        <Pressable
          onPress={handleToggleLike}
          className="items-center gap-y-1"
          accessibilityRole="button"
          accessibilityLabel="Like"
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={30}
            color={isLiked ? dColor : "#fff"}
          />
          <Typography.Caption1 className="text-white font-poppins-medium">
            {likeCount}
          </Typography.Caption1>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/comments/${item.id}`)}
          className="items-center gap-y-1"
          accessibilityRole="button"
          accessibilityLabel="Comments"
        >
          <Ionicons name="chatbubble-outline" size={28} color="#fff" />
          <Typography.Caption1 className="text-white font-poppins-medium">
            {commentCount}
          </Typography.Caption1>
        </Pressable>

        <Pressable
          onPress={() => void handleRepost()}
          disabled={isUpdatingRepost}
          className="items-center gap-y-1"
          accessibilityRole="button"
          accessibilityLabel="Repost"
        >
          <Ionicons
            name={isUpdatingRepost ? "hourglass-outline" : "repeat-outline"}
            size={28}
            color="#fff"
          />
          <Typography.Caption1 className="text-white font-poppins-medium">
            {repostCount}
          </Typography.Caption1>
        </Pressable>

        <Pressable onPress={handleToggleBookmark} accessibilityLabel="Bookmark">
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={28}
            color="#fff"
          />
        </Pressable>
      </View>
    </View>
  );
});

export default ReelVideoItemInner;
