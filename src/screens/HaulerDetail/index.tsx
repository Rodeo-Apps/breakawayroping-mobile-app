import React from "react";
import { Image, Linking, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Loader, ScreenWrapper, SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useHauler } from "@/services/supabase/useHauler";
import { formatHaulerLocation } from "@/utils/haulerLocation";
import { useTrackScreenFocus } from "@/analytics";

const priceLabel = (range: string) => {
  switch (range) {
    case "low":
      return "Budget";
    case "medium":
      return "Mid-range";
    case "high":
      return "Premium";
    default:
      return range;
  }
};

const HaulerDetailScreen = () => {
  const { haulerId } = useLocalSearchParams<{ haulerId: string }>();
  const id = Array.isArray(haulerId) ? haulerId[0] : haulerId;
  useTrackScreenFocus("hauler_detail", { hauler_id: id ?? "" });
  const { hauler, loading, error } = useHauler(id);
  const secondary = useCSSVariable("--color-secondaryText") as string;

  if (loading || !id) {
    return <Loader message="Loading hauler…" />;
  }

  if (error || !hauler) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Typography.Body1 className="text-secondaryText text-center">
          {error ?? "Hauler not found."}
        </Typography.Body1>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Typography.Body1 className="text-primary">Go back</Typography.Body1>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenWrapper withoutTPadding withoutBPadding>
        <SheetFormHeader title="Hauler" onClose={() => router.back()} />

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        >
          {hauler.cover_image_url ? (
            <Image
              source={{ uri: hauler.cover_image_url }}
              className="w-full aspect-video rounded-2xl bg-background-secondary mb-4"
              resizeMode="cover"
            />
          ) : null}
          <View className="flex-row items-start gap-3 mb-4">
            <View className="w-16 h-16 rounded-2xl bg-primary/15 items-center justify-center">
              <Ionicons name="car-sport" size={36} color={secondary} />
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1 flex-wrap">
                <Typography.Heading3
                  className="text-primaryText"
                  textProps={{ numberOfLines: 2 }}
                >
                  {hauler.business_name}
                </Typography.Heading3>
                {hauler.is_verified ? (
                  <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                ) : null}
              </View>
              <Typography.Body1
                className="text-secondaryText mt-1"
                textProps={{ numberOfLines: 3 }}
              >
                {formatHaulerLocation(hauler)}
              </Typography.Body1>
              <Typography.Caption1 className="text-secondaryText mt-1">
                {priceLabel(hauler.price_range)} · Up to {hauler.capacity}{" "}
                horses · {hauler.average_rating.toFixed(1)}★ (
                {hauler.total_reviews} reviews)
              </Typography.Caption1>
            </View>
          </View>

          {hauler.trailer_types.length > 0 ? (
            <View className="mb-4">
              <Typography.SubHeading2 className="text-primaryText mb-1">
                Trailer types
              </Typography.SubHeading2>
              <Typography.Body2 className="text-secondaryText capitalize">
                {hauler.trailer_types.join(", ")}
              </Typography.Body2>
            </View>
          ) : null}

          {hauler.service_area_states.length > 0 ? (
            <View className="mb-4">
              <Typography.SubHeading2 className="text-primaryText mb-1">
                Service areas
              </Typography.SubHeading2>
              <Typography.Body2 className="text-secondaryText">
                {hauler.service_area_states.join(", ")}
              </Typography.Body2>
            </View>
          ) : null}

          {hauler.description ? (
            <View className="mb-4">
              <Typography.SubHeading2 className="text-primaryText mb-1">
                About
              </Typography.SubHeading2>
              <Typography.Body2 className="text-secondaryText">
                {hauler.description}
              </Typography.Body2>
            </View>
          ) : null}

          <View className="gap-2">
            {hauler.phone_number ? (
              <Pressable
                onPress={() =>
                  void Linking.openURL(`tel:${hauler.phone_number}`)
                }
                className="flex-row items-center gap-2 py-2"
              >
                <Ionicons name="call-outline" size={20} color={secondary} />
                <Typography.Body1 className="text-primary">
                  {hauler.phone_number}
                </Typography.Body1>
              </Pressable>
            ) : null}
            {hauler.email ? (
              <Pressable
                onPress={() => void Linking.openURL(`mailto:${hauler.email}`)}
                className="flex-row items-center gap-2 py-2"
              >
                <Ionicons name="mail-outline" size={20} color={secondary} />
                <Typography.Body1 className="text-primary">
                  {hauler.email}
                </Typography.Body1>
              </Pressable>
            ) : null}
            {hauler.website ? (
              <Pressable
                onPress={() => {
                  const url = hauler.website?.startsWith("http")
                    ? hauler.website
                    : `https://${hauler.website}`;
                  void Linking.openURL(url ?? "");
                }}
                className="flex-row items-center gap-2 py-2"
              >
                <Ionicons name="globe-outline" size={20} color={secondary} />
                <Typography.Body1
                  className="text-primary"
                  textProps={{ numberOfLines: 1 }}
                >
                  {hauler.website}
                </Typography.Body1>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </ScreenWrapper>
    </View>
  );
};

export default HaulerDetailScreen;
