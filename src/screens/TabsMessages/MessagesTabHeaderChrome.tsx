import React from "react";
import { Alert, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

/** Default Messages tab header left (new chat / group). Shared with Stack layout and selection-mode reset. */
export const MessagesTabHeaderLeft = () => {
  const primaryText = useCSSVariable("--color-primaryText") as string;
  return (
    <Pressable
      onPress={() => router.push("/messages/new")}
      onLongPress={() =>
        Alert.alert("Message Actions", "Choose an action", [
          {
            text: "Create Group",
            onPress: () => router.push("/messages/new?mode=group"),
          },
          { text: "Cancel", style: "cancel" },
        ])
      }
      className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center"
    >
      <Feather name="plus" size={20} color={primaryText} />
    </Pressable>
  );
};

/** Matches useTabStackHeader right (bell only) for Messages tab. */
export const MessagesTabHeaderRight = () => {
  const primaryText = useCSSVariable("--color-primaryText") as string;
  return (
    <View className="flex-row items-center gap-x-2">
      <Pressable
        onPress={() => router.push("/search")}
        className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center"
        accessibilityLabel="Search users"
      >
        <Feather name="search" size={20} color={primaryText} />
      </Pressable>
      <Pressable className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center">
        <Feather name="bell" size={20} color={primaryText} />
      </Pressable>
    </View>
  );
};
