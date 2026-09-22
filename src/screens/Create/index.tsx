import { View, Pressable } from "react-native";
import React from "react";
import { Typography } from "@/utils/typography";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { FlatList } from "react-native-gesture-handler";
import { router } from "expo-router";
import { useTrackScreenFocus } from "@/analytics";

const CREATE_OPTIONS = [
  {
    id: "post",
    label: "Post",
    icon: "create-outline",
    screen: "/create-post",
  },
  {
    id: "story",
    label: "Story",
    icon: "camera-outline",
    screen: "/create-story",
  },
  {
    id: "run",
    label: "Add Run",
    icon: "timer-outline",
    screen: "/add-time-run",
  },
  {
    id: "horse",
    label: "Add Horse",
    icon: "paw-outline",
    screen: "/add-horse",
  },
  {
    id: "live",
    label: "Go Live",
    icon: "radio-outline",
    screen: "/more/go-live",
  },
  {
    id: "event",
    label: "Create Event",
    icon: "calendar-outline",
    screen: "/add-event",
  },
];

const CreateScreen = () => {
  useTrackScreenFocus("create_menu");
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerClassName="flex-1 px-5 py-6 bg-background gap-y-3"
      ListHeaderComponent={() => (
        <Typography.Heading3 className="mb-3">{`What you want to do?`}</Typography.Heading3>
      )}
      data={CREATE_OPTIONS}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          key={item.id}
          onPress={() => {
            router.replace(item.screen as any);
          }}
          className="flex-row items-center justify-between gap-x-3 bg-background-secondary rounded-full px-4 py-3"
        >
          <View className="flex-row items-center gap-x-3 flex-1">
            <Ionicons
              name={item.icon as any}
              size={24}
              color={primaryTextColor}
            />
            <Typography.Body1 className="text-primaryText">
              {item.label}
            </Typography.Body1>
          </View>
          <Feather name={"chevron-right"} size={24} color={primaryTextColor} />
        </Pressable>
      )}
    />
  );
};

export default CreateScreen;
