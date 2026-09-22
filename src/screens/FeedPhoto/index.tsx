import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { Typography } from "@/utils/typography";
import { useTrackScreenFocus } from "@/analytics";
import ZoomableImage from "./components/ZoomableImage";

const FeedPhotoScreen = () => {
  useTrackScreenFocus("feed_photo");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { uri: uriParam } = useLocalSearchParams<{
    uri?: string | string[];
  }>();
  const raw =
    typeof uriParam === "string"
      ? uriParam
      : Array.isArray(uriParam)
        ? uriParam[0]
        : undefined;
  const uri = raw ? decodeURIComponent(raw) : "";

  const [loading, setLoading] = useState(!!uri);
  const [loadError, setLoadError] = useState(false);

  const onClose = useCallback(() => {
    router.back();
  }, []);

  if (!uri) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Pressable onPress={onClose} accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Pressable
        onPress={onClose}
        className="absolute z-20 rounded-full bg-black/50"
        style={{ top: insets.top + 8, left: 16 }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>

      {loading && !loadError ? (
        <View
          className="absolute inset-0 z-10 items-center justify-center"
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : null}

      {loadError ? (
        <View className="flex-1 items-center justify-center px-8 pt-24">
          <Typography.Body1 className="text-white text-center">
            Could not load this image.
          </Typography.Body1>
        </View>
      ) : (
        <View className="flex-1 justify-center px-1">
          <ZoomableImage
            source={{ uri }}
            onLoadStart={() => {
              setLoadError(false);
              setLoading(true);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
          />
        </View>
      )}
    </View>
  );
};

export default FeedPhotoScreen;
