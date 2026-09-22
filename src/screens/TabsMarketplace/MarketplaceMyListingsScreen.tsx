import React, { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  Button,
  EmptyState,
  Loader,
  SheetFormHeader,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useMarketplaceListings } from "@/services/supabase/useMarketplaceListings";
import { useMarketplaceListingMutations } from "@/services/supabase/useMarketplaceListingMutations";
import type { T_MARKETPLACE_LISTING } from "@/services/supabase/marketplaceTypes";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  pending: "Pending",
  removed: "Removed",
};

const MarketplaceMyListingsScreen = () => {
  useTrackScreenFocus("marketplace_my_listings");
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;

  const { listings, loading, error, refresh } = useMarketplaceListings(
    profile?.id,
    "my_listings",
    "all",
    "newest",
  );
  const { markListingSold, deleteListing, renewListing } =
    useMarketplaceListingMutations(profile?.id);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleRenew = async (id: string) => {
    try {
      await renewListing(id);
      showAlert("Listing renewed for 60 days.", "success");
      await refresh();
    } catch (e: unknown) {
      showAlert(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not renew listing.",
        "error",
      );
    }
  };

  const handleMarkSold = (id: string) => {
    Alert.alert("Mark as sold?", "Buyers will no longer see this as active.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark sold",
        onPress: async () => {
          try {
            await markListingSold(id);
            showAlert("Listing marked as sold.", "success");
            await refresh();
          } catch (e: unknown) {
            showAlert(
              e && typeof e === "object" && "message" in e
                ? String((e as { message: string }).message)
                : "Could not update listing.",
              "error",
            );
          }
        },
      },
    ]);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete listing?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteListing(id);
            showAlert("Listing deleted.", "success");
            await refresh();
          } catch (e: unknown) {
            showAlert(
              e && typeof e === "object" && "message" in e
                ? String((e as { message: string }).message)
                : "Could not delete.",
              "error",
            );
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: T_MARKETPLACE_LISTING }) => {
    const cover = item.photos[0]?.photo_url;
    const days = daysUntil(item.expires_at);
    const expiringSoon =
      item.status === "active" && days != null && days <= 7;
    return (
      <View className="bg-background-secondary rounded-2xl border border-border overflow-hidden">
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/marketplace/listing/[listingId]",
              params: { listingId: item.id },
            })
          }
          className="flex-row gap-x-3 p-3 active:opacity-90"
        >
          <View className="w-20 h-20 rounded-xl overflow-hidden bg-background">
            {cover ? (
              <Image
                source={{ uri: cover }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={secondaryTextColor}
                />
              </View>
            )}
          </View>
          <View className="flex-1 gap-y-1">
            <Typography.SubHeading2
              className="text-primaryText"
              textProps={{ numberOfLines: 1 }}
            >
              {item.title}
            </Typography.SubHeading2>
            <Typography.SubHeading2 className="text-primary">
              {formatPrice(item.price)}
            </Typography.SubHeading2>
            <View className="flex-row items-center gap-x-2">
              <View
                className={`px-2 py-0.5 rounded-full ${
                  item.status === "active"
                    ? "bg-primary/15"
                    : "bg-background"
                }`}
              >
                <Typography.Caption1
                  className={
                    item.status === "active"
                      ? "text-primary"
                      : "text-secondaryText"
                  }
                >
                  {STATUS_LABEL[item.status] || item.status}
                </Typography.Caption1>
              </View>
              <Typography.Caption1 className="text-secondaryText">
                {item.views_count} views
              </Typography.Caption1>
            </View>
            {item.status === "active" && days != null && (
              <Typography.Caption1
                className={expiringSoon ? "text-danger" : "text-secondaryText"}
              >
                {days > 0
                  ? `Expires in ${days} day${days === 1 ? "" : "s"}`
                  : "Expired"}
              </Typography.Caption1>
            )}
          </View>
        </Pressable>

        <View className="flex-row gap-x-2 px-3 pb-3">
          <View className="flex-1">
            <Button
              title="Renew"
              variant="secondary"
              onPress={() => void handleRenew(item.id)}
            />
          </View>
          {item.status === "active" && (
            <View className="flex-1">
              <Button
                title="Mark sold"
                variant="secondary"
                onPress={() => handleMarkSold(item.id)}
              />
            </View>
          )}
          <View className="flex-1">
            <Button
              title="Delete"
              variant="outlined"
              onPress={() => handleDelete(item.id)}
            />
          </View>
        </View>
      </View>
    );
  };

  if (!profile?.id) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="My listings" onClose={() => router.back()} />
        <View className="flex-1 px-5 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to manage your listings.
          </Typography.Body2>
        </View>
      </View>
    );
  }

  if (loading && listings.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="My listings" onClose={() => router.back()} />
        <Loader message="Loading your listings..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="My listings"
        onClose={() => router.back()}
        primaryAction={{
          label: "New",
          onPress: () => router.push("/marketplace/new-listing"),
        }}
      />
      <View className="flex-1 px-5 pt-3">
        {error ? (
          <Typography.Body2 className="text-danger pb-2">{error}</Typography.Body2>
        ) : null}
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-16 gap-y-3"
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                <Ionicons
                  name="cart-outline"
                  size={28}
                  color={secondaryTextColor}
                />
              }
              message="You have no listings yet. Tap New to create one."
            />
          }
          renderItem={renderItem}
        />
      </View>
    </View>
  );
};

export default MarketplaceMyListingsScreen;
