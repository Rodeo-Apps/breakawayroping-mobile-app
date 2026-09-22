import React, { memo, useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFeedVideoState } from "@/hooks/useFeedViewability";
import MediaLoadingOverlay from "@/components/ui/MediaLoadingOverlay";

export const FEED_VIDEO_HEIGHT = Math.round(
  Dimensions.get("window").width * 1.25,
);

type FeedInlineVideoProps = {
  uri: string;
  /** List row id used for viewability (repost rows use the repost id). */
  viewabilityId: string;
  /** Post id passed to the full-screen reels route. */
  postId: string;
  height?: number;
};

const FeedInlineVideoPlaceholder = memo(function FeedInlineVideoPlaceholder({
  height,
}: {
  height: number;
}) {
  return (
    <View className="w-full bg-black items-center justify-center" style={{ height }}>
      <MediaLoadingOverlay tone="dark" size="large" />
    </View>
  );
});

const FeedInlineVideoPlayer = memo(function FeedInlineVideoPlayer({
  uri,
  postId,
  height,
  isPlaying,
}: {
  uri: string;
  postId: string;
  height: number;
  isPlaying: boolean;
}) {
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    setIsReady(player.status === "readyToPlay");
    const sub = player.addListener("statusChange", ({ status }) => {
      setIsReady(status === "readyToPlay");
    });
    return () => {
      sub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!player) return;
    if (isPlaying && isReady) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, isReady, player]);

  const openReels = useCallback(() => {
    router.push({
      pathname: "/feed-reels",
      params: { initialPostId: postId },
    });
  }, [postId]);

  return (
    <View className="w-full bg-black" style={{ height }}>
      <VideoView
        style={{ width: "100%", height: "100%" }}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
      {!isReady ? <MediaLoadingOverlay tone="dark" size="large" /> : null}
      <Pressable
        onPress={openReels}
        className="absolute inset-0 z-1"
        accessibilityRole="button"
        accessibilityLabel="Open video reels"
      />
      <Pressable
        onPress={() => setMuted((m) => !m)}
        className="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={muted ? "Unmute video" : "Mute video"}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-high"}
          size={20}
          color="#fff"
        />
      </Pressable>
    </View>
  );
});

const FeedInlineVideo = memo(function FeedInlineVideo({
  uri,
  viewabilityId,
  postId,
  height = FEED_VIDEO_HEIGHT,
}: FeedInlineVideoProps) {
  const { isMounted, isPlaying } = useFeedVideoState(viewabilityId);

  if (!isMounted) {
    return <FeedInlineVideoPlaceholder height={height} />;
  }

  return (
    <FeedInlineVideoPlayer
      uri={uri}
      postId={postId}
      height={height}
      isPlaying={isPlaying}
    />
  );
});

export default FeedInlineVideo;
