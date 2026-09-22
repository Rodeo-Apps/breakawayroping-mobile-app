import { View, Pressable, Text } from "react-native";
import React, { memo, useCallback } from "react";
import { T_STORY_ITEM } from "@/services/supabase/types";
import Avatar from "@/components/ui/Avatar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

type StoryItemProps = T_STORY_ITEM;

const StoryItem: React.FC<StoryItemProps> = memo(
  ({
    user_id,
    name,
    avatar_url,
    stories,
    has_unviewed,
    is_self,
  }) => {
    const onPrimary = useCSSVariable("--color-onPrimary") as string;
    const hasStories = stories.length > 0;

    const ringClass =
      has_unviewed
        ? "border-2 border-primary p-[2px]"
        : is_self && !hasStories
          ? "border-2 border-dashed border-border p-[2px]"
          : "border-2 border-border p-[2px]";

    const openCreate = useCallback(() => {
      router.push("/create-story");
    }, []);

    const openViewer = useCallback(() => {
      router.push({
        pathname: "/stories-viewer",
        params: { userId: user_id, startIndex: "0" },
      });
    }, [user_id]);

    const onMainPress = useCallback(() => {
      if (is_self) {
        if (hasStories) openViewer();
        else openCreate();
        return;
      }
      openViewer();
    }, [hasStories, is_self, openCreate, openViewer]);

    return (
      <View className="items-center justify-center gap-y-2 w-[72px]">
        <View className="relative w-[68px] items-center justify-center">
          <Pressable onPress={onMainPress} className="items-center">
            <View
              className={`rounded-full items-center justify-center ${ringClass}`}
            >
              <View className="rounded-full bg-background p-[2px]">
                <Avatar className="w-14 h-14" uri={avatar_url} name={name} />
              </View>
            </View>
          </Pressable>
          {is_self ? (
            <Pressable
              onPress={openCreate}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add story"
              className="absolute bottom-0 right-1 rounded-full bg-primary items-center justify-center w-7 h-7 border-2 border-background"
            >
              <Ionicons name="add" size={20} color={onPrimary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onMainPress}>
          <Text
            numberOfLines={1}
            className="text-center text-base font-oxygen-regular text-primaryText max-w-[72px]"
          >
            {name}
          </Text>
        </Pressable>
      </View>
    );
  },
);

StoryItem.displayName = "StoryItem";

export default StoryItem;
