import { View, FlatList, Text, ListRenderItemInfo } from "react-native";
import React, { useCallback, useMemo } from "react";
import { T_STORY_ITEM } from "@/services/supabase/types";
import StoryItem from "./story-item";
import { useAuth } from "@/provider/AuthProvider";

const STORY_ITEM_WIDTH = 72;
const STORY_GAP = 12;
const STORY_PADDING = 20;

const storyKeyExtractor = (item: T_STORY_ITEM) => item.user_id;

const getStoryLayout = (_: ArrayLike<T_STORY_ITEM> | null | undefined, index: number) => ({
  length: STORY_ITEM_WIDTH,
  offset: STORY_PADDING + index * (STORY_ITEM_WIDTH + STORY_GAP),
  index,
});

const Stories: React.FC<{ stories: T_STORY_ITEM[] }> = ({ stories }) => {
  const { profile } = useAuth();

  const orderedStories = useMemo(() => {
    if (!profile?.id) return stories;
    const selfRowFromApi = stories.find((s) => s.user_id === profile.id);
    const others = stories.filter((s) => s.user_id !== profile.id);
    const selfRow: T_STORY_ITEM = selfRowFromApi
      ? { ...selfRowFromApi, name: "Your story", is_self: true }
      : {
          user_id: profile.id,
          name: "Your story",
          avatar_url: profile.avatar_url ?? "",
          stories: [],
          has_unviewed: false,
          is_self: true,
        };
    return [selfRow, ...others];
  }, [profile?.id, profile?.avatar_url, stories]);

  const renderStoryItem = useCallback(
    ({ item }: ListRenderItemInfo<T_STORY_ITEM>) => {
      return <StoryItem {...item} />;
    },
    [],
  );

  return (
    <View className="gap-y-3">
      <Text className="px-5 text-xl font-ubuntu-bold text-primaryText">
        Stories
      </Text>
      <FlatList
        showsHorizontalScrollIndicator={false}
        horizontal
        data={orderedStories}
        keyExtractor={storyKeyExtractor}
        renderItem={renderStoryItem}
        getItemLayout={getStoryLayout}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        style={{ flexGrow: 0 }}
        contentContainerClassName="px-5 gap-x-3"
      />
    </View>
  );
};

export default Stories;
