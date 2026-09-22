import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  EmptyState,
  FloatingRoundedIconButton,
  Input,
  Loader,
  TopTabs,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import type {
  T_MARKETPLACE_CATEGORY,
  T_MARKETPLACE_LISTING,
  T_MARKETPLACE_SORT,
  T_MARKETPLACE_VIEW,
} from "@/services/supabase/marketplaceTypes";
import { useTrackScreenFocus } from "@/analytics";
import { useMarketplaceListings } from "@/services/supabase/useMarketplaceListings";
import { showAlert } from "@/utils/toast";
import MarketplaceListingCard from "./components/MarketplaceListingCard";

const VIEW_TABS: { value: T_MARKETPLACE_VIEW; label: string }[] = [
  { value: "browse", label: "Browse" },
  { value: "my_listings", label: "Mine" },
  { value: "saved", label: "Saved" },
];

const CATEGORIES: T_MARKETPLACE_CATEGORY[] = [
  "all",
  "horse",
  "saddle",
  "tack",
  "trailer",
  "gear",
  "apparel",
  "other",
];

const SORTS: { value: T_MARKETPLACE_SORT; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price ↑" },
  { value: "price_high", label: "Price ↓" },
];

const TabsMarketplaceScreen = () => {
  useTrackScreenFocus("tabs_marketplace");
  const { profile } = useAuth();
  const [view, setView] = useState<T_MARKETPLACE_VIEW>("browse");
  const [category, setCategory] = useState<T_MARKETPLACE_CATEGORY>("all");
  const [sort, setSort] = useState<T_MARKETPLACE_SORT>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const skipNextFocusRefresh = useRef(true);

  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;

  const { listings, loading, error, refresh, toggleSaveListing } =
    useMarketplaceListings(profile?.id, view, category, sort);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );

  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.location_city?.toLowerCase().includes(q) ||
        l.location_state?.toLowerCase().includes(q) ||
        l.location_address?.toLowerCase().includes(q),
    );
  }, [listings, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openDetail = (item: T_MARKETPLACE_LISTING) => {
    router.push({
      pathname: "/marketplace/listing/[listingId]",
      params: { listingId: item.id },
    });
  };

  const handleToggleSave = async (listingId: string, isSaved: boolean) => {
    try {
      await toggleSaveListing(listingId, isSaved);
    } catch {
      /* optional */
    }
  };

  if (loading && listings.length === 0) {
    return <Loader message="Loading marketplace..." />;
  }

  return (
    <View className="flex-1">
      <View className="flex-1 px-5 py-5 gap-y-4">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="storefront-outline" size={26} color={primaryColor} />
          <Typography.Heading2 className="text-primaryText">
            Marketplace
          </Typography.Heading2>
        </View>

        <TopTabs
          options={VIEW_TABS}
          selected={view}
          onChange={(v) => setView(v as T_MARKETPLACE_VIEW)}
        />

        {view === "my_listings" && !!profile?.id && (
          <Pressable
            onPress={() => router.push("/marketplace/my-listings")}
            className="flex-row items-center justify-center gap-x-2 py-2.5 rounded-full bg-background-secondary border border-border"
          >
            <Ionicons name="options-outline" size={18} color={primaryColor} />
            <Typography.Caption1 className="text-primary font-poppins-semibold">
              Manage listings (renew, mark sold, delete)
            </Typography.Caption1>
          </Pressable>
        )}

        <Input
          placeholder="Search listings..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Feather name="search" size={20} color={secondaryTextColor} />}
        />

        <View className="shrink-0" style={{ minHeight: 44 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{
              alignItems: "center",
              flexGrow: 0,
              paddingVertical: 2,
              minHeight: 40,
            }}
          >
            <View className="flex-row items-center gap-x-2 pr-2">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className={`px-4 py-2.5 rounded-full border ${
                      active
                        ? "bg-primary border-primary"
                        : "bg-background-secondary border-border"
                    }`}
                  >
                    <Typography.Caption1
                      className={
                        active
                          ? "text-onPrimary capitalize"
                          : "text-primaryText capitalize"
                      }
                    >
                      {cat === "all" ? "All" : cat}
                    </Typography.Caption1>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View className="flex-row items-center gap-x-2 flex-wrap shrink-0">
          {SORTS.map((s) => {
            const active = sort === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSort(s.value)}
                className={`px-3 py-1.5 rounded-full ${active ? "bg-primary/15" : "bg-transparent"}`}
              >
                <Typography.Caption1
                  className={
                    active
                      ? "text-primary font-poppins-semibold"
                      : "text-secondaryText"
                  }
                >
                  {s.label}
                </Typography.Caption1>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Typography.Body2 className="text-danger">{error}</Typography.Body2>
        ) : null}

        <FlatList
          style={{ flex: 1 }}
          data={filteredListings}
          keyExtractor={(item) => item.id}
          numColumns={1}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-32 gap-y-3"
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
              message={
                view === "saved"
                  ? "No saved listings yet."
                  : view === "my_listings"
                    ? "You have no listings yet. Tap + to create one."
                    : "No listings match your filters."
              }
            />
          }
          renderItem={({ item }) => (
            <MarketplaceListingCard
              item={item}
              onPress={() => openDetail(item)}
              onToggleSave={() => void handleToggleSave(item.id, item.is_saved)}
              showSave={!!profile?.id && view !== "my_listings"}
            />
          )}
        />
      </View>

      <FloatingRoundedIconButton
        icon={<Feather name="plus" size={22} color="#fff" />}
        onPress={() => {
          if (!profile?.id) {
            showAlert("Sign in to create a listing.", "warning");
            return;
          }
          router.push("/marketplace/new-listing");
        }}
        accessibilityLabel="Create listing"
      />
    </View>
  );
};

export default TabsMarketplaceScreen;
