import { FlatList, ListRenderItemInfo, View } from "react-native";
import React, { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";
import { EmptyState, Loader } from "@/components";
import { T_EVENT_ITEM, useGetEvents } from "@/services/supabase/useGetEvents";
import EventListViewItem from "./event-view-list-item";

const EventsListView = () => {
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const { events, loading, error } = useGetEvents();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T_EVENT_ITEM>) => {
      return (
        <EventListViewItem
          item={item}
          secondaryTextColor={secondaryTextColor}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/(events)/[eventId]",
              params: { eventId: item.id },
            })
          }
        />
      );
    },
    [secondaryTextColor],
  );

  if (loading) {
    return <Loader message="Loading active events..." />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={
          <Ionicons
            name="calendar-outline"
            size={28}
            color={secondaryTextColor}
          />
        }
        message={error || "No upcoming events found."}
      />
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerClassName="px-5 gap-y-4 pb-56"
    />
  );
};

export default EventsListView;
