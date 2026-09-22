import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  View,
} from "react-native";
import { ScreenWrapper } from "@/components";
import { useTrackScreenFocus } from "@/analytics";
import { useHomeData } from "@/services/supabase/useHomeData";
import { useCSSVariable } from "uniwind";
import { Typography } from "@/utils/typography";
import Stories from "./components/Stories";
import FeedCard from "./components/FeedCard";
import { T_FEED_ITEM } from "@/services/supabase/types";
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

const TabsHomeScreen = () => {
  useTrackScreenFocus("tabs_home");
  const { feeds, stories, loading, refreshing, loadingMore, loadMoreFeeds, refresh } =
    useHomeData();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { store, viewabilityConfigCallbackPairs } =
    useFeedViewabilityController();
  usePrefetchFeedImages(feeds);

  const renderListHeader = useCallback(() => {
    return <Stories stories={stories} />;
  }, [stories]);

  const renderFeedCard = useCallback(
    ({ item }: ListRenderItemInfo<T_FEED_ITEM>) => {
      return <FeedCard item={item} />;
    },
    [],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View className="py-6 items-center justify-center gap-y-2">
        <ActivityIndicator size="small" color="#52b2cf" />
        <Typography.Body2 className="text-secondaryText">
          Loading more posts...
        </Typography.Body2>
      </View>
    );
  }, [loadingMore]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size={"small"} color="#52b2cf" />
      </View>
    );

  return (
    <ScreenWrapper withoutBPadding withoutTPadding>
      <FeedViewabilityProvider value={store}>
        <View className="flex-1">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={feeds}
            keyExtractor={feedKeyExtractor}
            ListHeaderComponent={renderListHeader}
            renderItem={renderFeedCard}
            ListFooterComponent={renderFooter}
            extraData={loadingMore}
            contentContainerClassName="flex-grow py-6 pb-56"
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
            ItemSeparatorComponent={FeedItemSeparator}
            onEndReached={loadMoreFeeds}
            onEndReachedThreshold={FEED_LIST_PERF.onEndReachedThreshold}
            initialNumToRender={FEED_LIST_PERF.initialNumToRender}
            maxToRenderPerBatch={FEED_LIST_PERF.maxToRenderPerBatch}
            windowSize={FEED_LIST_PERF.windowSize}
            updateCellsBatchingPeriod={FEED_LIST_PERF.updateCellsBatchingPeriod}
            removeClippedSubviews={FEED_LIST_PERF.removeClippedSubviews}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={primaryColor}
                colors={[primaryColor]}
              />
            }
          />
        </View>
      </FeedViewabilityProvider>
    </ScreenWrapper>
  );
};

export default TabsHomeScreen;
