import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenWrapper, IconTabs } from "@/components";
import { useTrackScreenFocus } from "@/analytics";
import { Typography } from "@/utils/typography";
import { T_EVENT_TAB } from "./types";
import EventsListView from "./components/EventsListView";
import EventsMapView from "./components/EventsMapView";

const TabsEventsScreen = () => {
  useTrackScreenFocus("tabs_events");
  const [activeTab, setActiveTab] = useState<T_EVENT_TAB>("list_view");
  const tabOptions = useMemo(
    () => [
      {
        value: "list_view",
        renderIcon: (isActive: boolean) => (
          <Ionicons
            name="list-outline"
            size={20}
            color={isActive ? "#ffffff" : "#6b7280"}
          />
        ),
      },
      {
        value: "map_view",
        renderIcon: (isActive: boolean) => (
          <Ionicons
            name="map-outline"
            size={20}
            color={isActive ? "#ffffff" : "#6b7280"}
          />
        ),
      },
    ],
    [],
  );

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <View className="flex-1 py-6 gap-y-6">
        {/* Heading */}
        <View className="flex-row items-start px-5 gap-x-3">
          <View className="gap-y-1 flex-1">
            <Typography.Heading3 className="text-primaryText">
              Events
            </Typography.Heading3>
            <Typography.Body1 className="text-secondaryText">
              View all events added by community members
            </Typography.Body1>
          </View>
          <IconTabs
            options={tabOptions}
            selected={activeTab}
            onChange={(value) => setActiveTab(value as T_EVENT_TAB)}
          />
        </View>

        <View className="flex-1">
          {activeTab === "list_view" ? <EventsListView /> : <EventsMapView />}
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default TabsEventsScreen;
