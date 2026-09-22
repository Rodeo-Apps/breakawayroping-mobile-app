import { Pressable, View } from "react-native";
import React, { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components";
import { Typography } from "@/utils/typography";
import { T_EVENT_ITEM } from "@/services/supabase/useGetEvents";

type T_EVENT_LIST_VIEW_ITEM = {
  item: T_EVENT_ITEM;
  secondaryTextColor: string;
  onPress?: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBA";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatFee = (fee?: number | null, currency = "USD") => {
  if (typeof fee !== "number") return "Entry fee TBA";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(fee);
  } catch {
    return `$${fee.toFixed(2)}`;
  }
};

const EventListViewItem = ({
  item,
  secondaryTextColor,
  onPress,
}: T_EVENT_LIST_VIEW_ITEM) => {
  const eventTitle = item.event_name || item.name || "Untitled Event";
  const locationText = item.location_name || item.address || "Location TBA";
  const eventDate = formatDate(item.start_date || item.date);
  const entryFee = formatFee(item.entry_fee, item.currency || "USD");
  const organizerName = item.producer?.name?.trim() || "Organizer";

  return (
    <View className="bg-background-secondary rounded-2xl border border-border overflow-hidden">
      <Pressable onPress={onPress} className="active:opacity-90 p-4 gap-y-2">
        <View className="flex-row items-center justify-between gap-x-3">
          <View className="flex-row items-center gap-x-3 flex-1 min-w-0">
            <Avatar
              uri={item.producer?.avatar_url ?? undefined}
              name={organizerName}
              className="w-8 h-8"
            />
            <Typography.Body2
              className="text-primaryText flex-1"
              textProps={{ numberOfLines: 1 }}
            >
              {organizerName}
            </Typography.Body2>
          </View>
          <View className="flex-row items-center gap-x-2">
            {item.is_live && (
              <View className="flex-row items-center gap-x-1 rounded-full bg-red-500/15 px-2 py-0.5 border border-red-500/40">
                <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <Typography.Body2 className="text-xs text-red-500 font-semibold">
                  LIVE
                </Typography.Body2>
              </View>
            )}
            {item.is_registered && (
              <View className="flex-row items-center gap-x-1 rounded-full bg-success/15 px-2 py-0.5 border border-success/30">
                <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                <Typography.Body2 className="text-xs text-success">
                  Registered
                </Typography.Body2>
              </View>
            )}
          </View>
        </View>

        <Typography.SubHeading2 className="text-primaryText">
          {eventTitle}
        </Typography.SubHeading2>

        <View className="flex-row items-center gap-x-3">
          <Ionicons name="location-outline" size={14} color={secondaryTextColor} />
          <Typography.Body2 className="text-secondaryText flex-1">
            {locationText}
          </Typography.Body2>
        </View>

        <View className="flex-row items-center gap-x-3">
          <Ionicons name="time-outline" size={14} color={secondaryTextColor} />
          <Typography.Body2 className="text-secondaryText">{eventDate}</Typography.Body2>
        </View>

        <View className="flex-row items-center gap-x-3">
          <Ionicons name="cash-outline" size={14} color={secondaryTextColor} />
          <Typography.Body2 className="text-secondaryText">{entryFee}</Typography.Body2>
        </View>
      </Pressable>
    </View>
  );
};

export default memo(EventListViewItem);
