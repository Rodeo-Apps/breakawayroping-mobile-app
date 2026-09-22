import React from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Typography } from "@/utils/typography";
import type { T_MARKETPLACE_LISTING } from "@/services/supabase/marketplaceTypes";

type T_PROPS = {
  item: T_MARKETPLACE_LISTING;
  onPress: () => void;
  onToggleSave: () => void;
  showSave?: boolean;
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const listingLocationSubtitle = (item: T_MARKETPLACE_LISTING) => {
  if (item.location_address) {
    const line = item.location_address.split(",")[0]?.trim() || item.location_address;
    return line.length > 36 ? `${line.slice(0, 33)}…` : line;
  }
  if (item.location_city || item.location_state) {
    return [item.location_city, item.location_state].filter(Boolean).join(", ");
  }
  return "";
};

const MarketplaceListingCard: React.FC<T_PROPS> = ({
  item,
  onPress,
  onToggleSave,
  showSave = true,
}) => {
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;
  const cover = item.photos[0]?.photo_url;
  const locationLine = listingLocationSubtitle(item);

  return (
    <View className="bg-background-secondary rounded-2xl border border-border overflow-hidden">
      <Pressable onPress={onPress} className="active:opacity-90">
        <View className="h-44 bg-background">
          {cover ? (
            <Image source={{ uri: cover }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={40} color={secondaryTextColor} />
            </View>
          )}
        </View>
        <View className="p-3 gap-y-1">
          <Typography.SubHeading2 className="text-primaryText" textProps={{ numberOfLines: 2 }}>
            {item.title}
          </Typography.SubHeading2>
          <Typography.SubHeading2 className="text-primary">
            {formatPrice(item.price)}
          </Typography.SubHeading2>
          <View className="flex-row items-center justify-between gap-x-2">
            <Typography.Caption1 className="text-secondaryText capitalize">
              {item.category}
              {locationLine ? ` · ${locationLine}` : ""}
            </Typography.Caption1>
            <Typography.Caption1 className="text-secondaryText">
              {item.profile?.name || "Seller"}
            </Typography.Caption1>
          </View>
        </View>
      </Pressable>
      {showSave && (
        <Pressable
          onPress={onToggleSave}
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-background/90 items-center justify-center border border-border"
          hitSlop={8}
        >
          <Ionicons
            name={item.is_saved ? "bookmark" : "bookmark-outline"}
            size={22}
            color={item.is_saved ? primaryColor : secondaryTextColor}
          />
        </Pressable>
      )}
    </View>
  );
};

export default MarketplaceListingCard;
