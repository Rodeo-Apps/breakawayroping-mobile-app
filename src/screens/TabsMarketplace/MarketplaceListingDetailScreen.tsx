import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCSSVariable } from "uniwind";
import { Avatar, Button, Loader, SheetFormHeader } from "@/components";
import { supabase } from "@/lib/supabase";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  recordListingInquiry,
  recordListingView,
  useMarketplaceListingMutations,
} from "@/services/supabase/useMarketplaceListingMutations";
import { useMarketplaceListingDetail } from "@/services/supabase/useMarketplaceListingDetail";
import { useMarketplacePayment } from "@/services/stripe/useMarketplacePayment";
import {
  computeMarketplaceFees,
  formatCents,
} from "@/services/stripe/marketplaceFees";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

const MarketplaceListingDetailScreen = () => {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const id = typeof listingId === "string" ? listingId : listingId?.[0];
  useTrackScreenFocus("marketplace_listing_detail", { listing_id: id ?? "" });
  const { profile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const [imgIndex, setImgIndex] = useState(0);
  const { listing, loading, error, refresh } = useMarketplaceListingDetail(
    id,
    profile?.id,
  );
  const { markListingSold, deleteListing, renewListing } =
    useMarketplaceListingMutations(profile?.id);
  const { loading: paying, buyListing } = useMarketplacePayment();

  useEffect(() => {
    setImgIndex(0);
  }, [listing?.id]);

  useFocusEffect(
    useCallback(() => {
      if (listing?.id) {
        void recordListingView(listing.id);
      }
    }, [listing?.id]),
  );

  const handleToggleSave = async () => {
    if (!profile?.id || !listing) return;
    try {
      if (listing.is_saved) {
        const { error: delErr } = await supabase
          .from("listing_saves")
          .delete()
          .eq("listing_id", listing.id)
          .eq("user_id", profile.id);
        if (delErr) throw delErr;
      } else {
        const { error: insErr } = await supabase.from("listing_saves").insert({
          listing_id: listing.id,
          user_id: profile.id,
        });
        if (insErr) throw insErr;
      }
      await refresh();
    } catch {
      showAlert("Could not update saved listings.", "error");
    }
  };

  const contactSeller = async () => {
    if (!listing) return;
    if (!listing.contact_message) {
      showAlert("This seller has not enabled messages.", "warning");
      return;
    }
    try {
      await recordListingInquiry(listing.id);
    } catch {
      /* optional */
    }
    router.replace({
      pathname: "/messages/chat",
      params: {
        type: "dm",
        userId: listing.user_id,
        title: listing.profile?.name || "Seller",
      },
    });
  };

  const handleBuy = async () => {
    if (!listing) return;
    if (!profile?.id) {
      showAlert("Sign in to buy this listing.", "warning");
      return;
    }
    const result = await buyListing({ listingId: listing.id });
    if (result.cancelled) return;
    if (result.success) {
      showAlert("Payment successful! The seller has been notified.", "success");
      await refresh();
    } else {
      showAlert(result.message || "Payment could not be completed.", "error");
    }
  };

  if (loading && !listing) {
    return <Loader message="Loading listing..." />;
  }

  if (error || !listing) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Listing" onClose={() => router.back()} />
        <View className="flex-1 px-5 justify-center">
          <Typography.Body2 className="text-danger text-center">
            {error || "Listing not found."}
          </Typography.Body2>
        </View>
      </View>
    );
  }

  const isOwner = profile?.id === listing.user_id;
  const images = listing.photos.length > 0 ? listing.photos : [];

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="Listing"
        onClose={() => router.back()}
        trailing={
          !isOwner && profile?.id ? (
            <Pressable
              onPress={() => void handleToggleSave()}
              className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={
                listing.is_saved ? "Remove save" : "Save listing"
              }
            >
              <Ionicons
                name={listing.is_saved ? "bookmark" : "bookmark-outline"}
                size={22}
                color={primaryTextColor}
              />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="h-64 bg-background-secondary">
          {images.length > 0 ? (
            <FlatList
              horizontal
              pagingEnabled
              data={images}
              keyExtractor={(_, i) => `${listing.id}-img-${i}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                setImgIndex(Math.round(x / windowWidth));
              }}
              renderItem={({ item: img }) => (
                <Image
                  source={{ uri: img.photo_url }}
                  resizeMode="cover"
                  style={{ width: windowWidth, height: 256 }}
                />
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center h-64">
              <Ionicons
                name="image-outline"
                size={48}
                color={secondaryTextColor}
              />
            </View>
          )}
          {images.length > 1 && (
            <Typography.Caption1 className="text-secondaryText text-center py-1">
              {imgIndex + 1} / {images.length}
            </Typography.Caption1>
          )}
        </View>

        <View className="px-5 py-5 gap-y-4">
          <View className="flex-row items-start justify-between gap-x-3">
            <View className="flex-1">
              <Typography.Heading3 className="text-primaryText">
                {listing.title}
              </Typography.Heading3>
              <Typography.SubHeading1 className="text-primary mt-1">
                {formatPrice(listing.price)}
              </Typography.SubHeading1>
            </View>
          </View>

          <View className="flex-row items-center gap-x-3">
            <Avatar
              uri={listing.profile?.avatar_url || undefined}
              name={listing.profile?.name || "Seller"}
              className="w-12 h-12"
            />
            <View className="flex-1">
              <Typography.SubHeading2 className="text-primaryText">
                {listing.profile?.name || "Seller"}
              </Typography.SubHeading2>
              <Typography.Caption1 className="text-secondaryText capitalize">
                {listing.category}
                {listing.condition ? ` · ${listing.condition}` : ""}
              </Typography.Caption1>
            </View>
          </View>

          {(listing.location_address ||
            listing.location_city ||
            listing.location_state) && (
            <View className="flex-row items-center gap-x-2">
              <Ionicons
                name="location-outline"
                size={18}
                color={secondaryTextColor}
              />
              <Typography.Body2 className="text-secondaryText">
                {listing.location_address ||
                  [listing.location_city, listing.location_state]
                    .filter(Boolean)
                    .join(", ")}
              </Typography.Body2>
            </View>
          )}

          <Typography.SubHeading2 className="text-primaryText">
            Description
          </Typography.SubHeading2>
          <Typography.Body2 className="text-primaryText">
            {listing.description}
          </Typography.Body2>

          <Typography.Caption1 className="text-secondaryText">
            Status: {listing.status} · {listing.views_count} views
          </Typography.Caption1>

          {!isOwner && listing.payment_type === "stripe" && (
            <View className="gap-y-3">
              <View className="rounded-2xl border border-border bg-background-secondary p-3 gap-y-2">
                <View className="flex-row items-center gap-x-2">
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={primaryTextColor}
                  />
                  <Typography.SubHeading2 className="text-primaryText">
                    Secure in-app checkout
                  </Typography.SubHeading2>
                </View>
                {(() => {
                  const fees = computeMarketplaceFees(
                    listing.price,
                    listing.fee_split,
                  );
                  return (
                    <>
                      <View className="flex-row justify-between">
                        <Typography.Caption1 className="text-secondaryText">
                          Item price
                        </Typography.Caption1>
                        <Typography.Caption1 className="text-primaryText">
                          {formatCents(fees.basePriceCents)}
                        </Typography.Caption1>
                      </View>
                      <View className="flex-row justify-between">
                        <Typography.Caption1 className="text-secondaryText">
                          Processing fee
                          {listing.fee_split ? " (split 50/50)" : ""}
                        </Typography.Caption1>
                        <Typography.Caption1 className="text-primaryText">
                          {formatCents(fees.buyerFeeCents)}
                        </Typography.Caption1>
                      </View>
                      <View className="flex-row justify-between border-t border-border pt-2">
                        <Typography.Body2 className="text-primaryText">
                          You pay
                        </Typography.Body2>
                        <Typography.SubHeading2 className="text-primary">
                          {formatCents(fees.buyerTotalCents)}
                        </Typography.SubHeading2>
                      </View>
                    </>
                  );
                })()}
              </View>
              {listing.status === "active" ? (
                <Button
                  title="Buy securely"
                  loading={paying}
                  onPress={() => void handleBuy()}
                />
              ) : (
                <Typography.Body2 className="text-secondaryText text-center">
                  This item is no longer available.
                </Typography.Body2>
              )}
              <Button
                title="Message seller"
                variant="secondary"
                onPress={() => void contactSeller()}
              />
            </View>
          )}

          {!isOwner && listing.payment_type !== "stripe" && (
            <View className="gap-y-3">
              <View className="rounded-2xl border border-border bg-background-secondary p-3 gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  How to pay this seller
                </Typography.SubHeading2>
                <Typography.Caption1 className="text-secondaryText">
                  Payment is arranged directly with the seller — Breakaway Connect
                  doesn&apos;t process this sale.
                </Typography.Caption1>
                {listing.payment_handles?.venmo ? (
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Venmo
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {listing.payment_handles.venmo}
                    </Typography.Caption1>
                  </View>
                ) : null}
                {listing.payment_handles?.paypal ? (
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      PayPal
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {listing.payment_handles.paypal}
                    </Typography.Caption1>
                  </View>
                ) : null}
                {listing.payment_handles?.cashapp ? (
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Cash App
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {listing.payment_handles.cashapp}
                    </Typography.Caption1>
                  </View>
                ) : null}
                {listing.payment_handles?.zelle ? (
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Zelle
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {listing.payment_handles.zelle}
                    </Typography.Caption1>
                  </View>
                ) : null}
                {listing.accepts_cash ? (
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Cash
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      Accepted in person
                    </Typography.Caption1>
                  </View>
                ) : null}
              </View>
              <Button
                title="Contact seller"
                onPress={() => void contactSeller()}
              />
            </View>
          )}

          {isOwner && (
            <View className="gap-y-3 pt-2">
              <Button
                title="Renew for 60 days"
                variant="secondary"
                onPress={async () => {
                  try {
                    await renewListing(listing.id);
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
                }}
              />
              {listing.status === "active" && (
                <Button
                  title="Mark as sold"
                  variant="secondary"
                  onPress={() =>
                    Alert.alert(
                      "Mark as sold?",
                      "Buyers will no longer see this as active.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Mark sold",
                          onPress: async () => {
                            try {
                              await markListingSold(listing.id);
                              showAlert("Listing marked as sold.", "success");
                              router.back();
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
                      ],
                    )
                  }
                />
              )}
              <Button
                title="Delete listing"
                variant="outlined"
                onPress={() =>
                  Alert.alert("Delete listing?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteListing(listing.id);
                          showAlert("Listing deleted.", "success");
                          router.back();
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
                  ])
                }
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default MarketplaceListingDetailScreen;
