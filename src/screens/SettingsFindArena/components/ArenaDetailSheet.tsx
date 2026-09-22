import React from "react";
import { View, ScrollView, Pressable, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openGoogleMapsDirections } from "@/utils/googleMaps";
import type { T_ARENA_LIST_ITEM } from "@/services/supabase/useArenaFinderList";

type Props = {
  open: boolean;
  arena: T_ARENA_LIST_ITEM | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ArenaDetailSheet({
  open,
  arena,
  isOwner,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!open || !arena) return null;

  const openMaps = () => {
    const lat = arena.latitude != null ? Number(arena.latitude) : null;
    const lng = arena.longitude != null ? Number(arena.longitude) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      openGoogleMapsDirections({ latitude: lat, longitude: lng });
      return;
    }
    const q = [arena.address, arena.city, arena.state, arena.zip]
      .filter(Boolean)
      .join(", ");
    if (q) openGoogleMapsDirections(q);
  };

  const callPhone = () => {
    if (!arena.phone?.trim()) return;
    Linking.openURL(`tel:${arena.phone.replace(/\s/g, "")}`).catch(() => {});
  };

  const openWebsite = () => {
    const w = arena.website?.trim();
    if (!w) return;
    const url = w.startsWith("http") ? w : `https://${w}`;
    Linking.openURL(url).catch(() => {});
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete arena",
      `Remove “${arena.name}”? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <View className="absolute inset-0 z-60 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[90%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader title={arena.name} onClose={onClose} />
        <ScrollView
          className="px-5 py-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="gap-y-6">
            {arena.distanceLabel ? (
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="navigate" size={18} color="#3b82f6" />
                <Typography.Body2 className="text-primary font-poppins-semibold">
                  {arena.distanceLabel} away
                </Typography.Body2>
              </View>
            ) : null}

            <View className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-2">
              <Typography.Caption1 className="text-secondaryText uppercase">
                Address
              </Typography.Caption1>
              <Typography.Body2 className="text-primaryText">
                {arena.address}
                {arena.city || arena.state || arena.zip
                  ? `\n${[arena.city, arena.state, arena.zip].filter(Boolean).join(", ")}`
                  : ""}
              </Typography.Body2>
            </View>

            <View className="flex-row flex-wrap gap-x-3 gap-y-2 items-center">
              <Typography.Caption1 className="text-secondaryText capitalize">
                {arena.arena_type}
              </Typography.Caption1>
              <View className="flex-row items-center gap-x-1">
                <Ionicons name="star" size={16} color="#fbbf24" />
                <Typography.Body2 className="text-primaryText">
                  {Number(arena.rating).toFixed(1)} ({arena.review_count} reviews)
                </Typography.Body2>
              </View>
            </View>

            {arena.description ? (
              <Typography.Body2 className="text-secondaryText leading-6">
                {arena.description}
              </Typography.Body2>
            ) : null}

            {arena.amenities?.length ? (
              <View className="gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  Amenities
                </Typography.SubHeading2>
                <View className="flex-row flex-wrap gap-2">
                  {arena.amenities.map((a) => (
                    <View
                      key={a}
                      className="bg-primary/10 px-3 py-1.5 rounded-full"
                    >
                      <Typography.Caption1 className="text-primary">
                        {a.replace(/_/g, " ")}
                      </Typography.Caption1>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="gap-y-3">
              <Button title="Directions" onPress={openMaps} />
              {arena.phone ? (
                <Button
                  title={`Call ${arena.phone}`}
                  variant="outlined"
                  onPress={callPhone}
                />
              ) : null}
              {arena.website ? (
                <Button
                  title="Website"
                  variant="outlined"
                  onPress={openWebsite}
                />
              ) : null}
            </View>

            {isOwner ? (
              <View className="gap-y-3 pt-2">
                <Button title="Edit listing" onPress={onEdit} />
                <Button
                  title="Delete listing"
                  variant="outlined"
                  onPress={confirmDelete}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
