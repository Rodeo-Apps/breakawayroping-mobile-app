import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
  useWindowDimensions,
  type FlatList as FlatListType,
  type ViewToken,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTrackScreenFocus } from "@/analytics";
import { Typography } from "@/utils/typography";
import type { T_FEED_ITEM } from "@/services/supabase/types";
import { useVideoReelsFeed } from "@/services/supabase/useVideoReelsFeed";
import ReelVideoItem from "./components/ReelVideoItem";

const FeedReelsScreen = () => {
  useTrackScreenFocus("feed_reels");
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { initialPostId: initialParam } = useLocalSearchParams<{
    initialPostId?: string | string[];
  }>();
  const initialPostId =
    typeof initialParam === "string"
      ? initialParam
      : Array.isArray(initialParam)
        ? initialParam[0]
        : undefined;

  const { items, loading, error } = useVideoReelsFeed(initialPostId);
  const listRef = useRef<FlatListType<T_FEED_ITEM>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const didScrollToInitial = useRef(false);

  const initialIndex = useMemo(() => {
    if (!initialPostId || !items.length) return 0;
    const i = items.findIndex((r) => r.id === initialPostId);
    return i >= 0 ? i : 0;
  }, [initialPostId, items]);

  useEffect(() => {
    if (items.length > 0) {
      setActiveIndex(initialIndex);
    }
  }, [items.length, initialIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 85,
    minimumViewTime: 120,
  }).current;

  const scrollToInitial = useCallback(() => {
    if (didScrollToInitial.current || !items.length || initialIndex <= 0) return;
    didScrollToInitial.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: initialIndex,
        animated: false,
      });
      setActiveIndex(initialIndex);
    });
  }, [initialIndex, items.length]);

  const onContentSizeChange = useCallback(() => {
    scrollToInitial();
  }, [scrollToInitial]);

  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      const offset = info.index * height;
      listRef.current?.scrollToOffset({ offset, animated: false });
    },
    [height],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: T_FEED_ITEM; index: number }) => (
      <ReelVideoItem
        item={item}
        isActive={index === activeIndex}
        height={height}
      />
    ),
    [activeIndex, height],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const keyExtractor = useCallback((item: T_FEED_ITEM) => item.id, []);

  if (loading && !items.length) {
    return (
      <View
        className="flex-1 bg-black items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error || !items.length) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Pressable
          onPress={() => router.back()}
          className="absolute z-10"
          style={{ top: insets.top + 8, left: 16 }}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Typography.Body1 className="text-white text-center mt-16">
          {error || "No videos to show."}
        </Typography.Body1>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Pressable
        onPress={() => router.back()}
        className="absolute z-20"
        style={{ top: insets.top + 8, left: 12 }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={30} color="#fff" />
      </Pressable>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={3}
        onContentSizeChange={onContentSizeChange}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
    </View>
  );
};

export default FeedReelsScreen;
