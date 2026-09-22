import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  EmptyState,
  FloatingRoundedIconButton,
  HaulerCard,
  Input,
  Loader,
  ScreenWrapper,
  TopTabs,
  TransportTripCard,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { openGoogleMapsDirections } from "@/utils/googleMaps";
import { tripEndpointCoords, tripEndpointLabel } from "@/utils/tripLabels";
import { showAlert } from "@/utils/toast";
import type { T_HAULER_ROW } from "@/services/supabase/haulingTypes";
import { useHaulersList } from "@/services/supabase/useHaulersList";
import { useHaulingMutations } from "@/services/supabase/useHaulingMutations";
import { useMyTransportTrips } from "@/services/supabase/useMyTransportTrips";
import { useMyTripRequests } from "@/services/supabase/useMyTripRequests";
import { useTransportTrips } from "@/services/supabase/useTransportTrips";
import type { T_TRANSPORT_TRIP_WITH_DRIVER } from "@/services/supabase/haulingTypes";

type T_TAB = "directory" | "rideshare" | "my";

const TRAILER_FILTERS = [
  null,
  "slant load",
  "stock",
  "gooseneck",
  "straight load",
] as const;

const HaulingScreen = () => {
  const { profile } = useAuth();
  const secondaryText = useCSSVariable("--color-secondaryText") as string;

  const [tab, setTab] = useState<T_TAB>("directory");
  const [sortBy, setSortBy] = useState<"rating" | "price">("rating");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTrailerType, setFilterTrailerType] = useState<string | null>(
    null,
  );

  const {
    haulers,
    loading: haulersLoading,
    refresh: refreshHaulers,
  } = useHaulersList(sortBy);
  const {
    trips,
    loading: tripsLoading,
    refresh: refreshTrips,
  } = useTransportTrips();
  const {
    myTrips,
    loading: myTripsLoading,
    refresh: refreshMyTrips,
  } = useMyTransportTrips(profile?.id);
  const {
    myRequests,
    loading: myReqLoading,
    refresh: refreshMyRequests,
  } = useMyTripRequests(profile?.id);

  const { requestToJoinTrip, respondToTripRequest } =
    useHaulingMutations(profile?.id);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshHaulers(),
      refreshTrips(),
      refreshMyTrips(),
      refreshMyRequests(),
    ]);
  }, [refreshHaulers, refreshTrips, refreshMyTrips, refreshMyRequests]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  const sortInitial = useRef(true);
  useEffect(() => {
    if (sortInitial.current) {
      sortInitial.current = false;
      return;
    }
    void refreshHaulers();
  }, [sortBy, refreshHaulers]);

  useEffect(() => {
    if (!profile?.id) return;
    void refreshMyTrips();
    void refreshMyRequests();
  }, [profile?.id, refreshMyTrips, refreshMyRequests]);

  const filteredHaulers = useMemo(() => {
    let list = haulers;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.business_name.toLowerCase().includes(q) ||
          (h.address ?? "").toLowerCase().includes(q) ||
          (h.city ?? "").toLowerCase().includes(q) ||
          (h.state ?? "").toLowerCase().includes(q) ||
          h.service_area_states.some((s) => s.toLowerCase().includes(q)),
      );
    }
    if (filterTrailerType) {
      list = list.filter((h) => h.trailer_types.includes(filterTrailerType));
    }
    return list;
  }, [haulers, searchQuery, filterTrailerType]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const topTabOptions = useMemo(
    () => [
      { label: "Directory", value: "directory" },
      { label: "Rideshare", value: "rideshare" },
      { label: "My transport", value: "my" },
    ],
    [],
  );

  const onTabChange = (value: string) => {
    setTab(value as T_TAB);
  };

  const openHauler = useCallback((id: string) => {
    router.push(`/hauler/${id}`);
  }, []);

  const openNewHauler = useCallback(() => {
    router.push("/hauling/directory-listing");
  }, []);

  const openEditHauler = useCallback((h: T_HAULER_ROW) => {
    router.push({
      pathname: "/hauling/directory-listing",
      params: { haulerId: h.id },
    });
  }, []);

  const handleRequestJoin = async (tripId: string) => {
    try {
      await requestToJoinTrip(tripId);
      showAlert("Trip request sent.", "success");
      await refreshTrips();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "";
      if (msg === "ALREADY_REQUESTED") {
        showAlert("You already requested this trip.", "warning");
      } else {
        showAlert(msg || "Could not send request.", "error");
      }
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondToTripRequest(requestId, accept);
      showAlert(accept ? "Request accepted." : "Request declined.", "success");
      await refreshMyTrips();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not update request.";
      showAlert(msg, "error");
    }
  };

  const renderHauler: ListRenderItem<T_HAULER_ROW> = ({ item }) => (
    <HaulerCard
      hauler={item}
      onPress={() => openHauler(item.id)}
      onLongPress={() => openEditHauler(item)}
    />
  );

  const renderTrip: ListRenderItem<T_TRANSPORT_TRIP_WITH_DRIVER> = ({
    item,
  }) => (
      <TransportTripCard
        trip={item}
        showRequestButton={item.driver_id !== profile?.id}
        onRequestToJoin={() => void handleRequestJoin(item.id)}
        onDirections={() => {
          const destCoords = tripEndpointCoords(item, "destination");
          const originCoords = tripEndpointCoords(item, "origin");
          const dest =
            destCoords ??
            tripEndpointLabel(item, "destination");
          const origin =
            originCoords ?? tripEndpointLabel(item, "origin");
          openGoogleMapsDirections(dest, origin);
        }}
      />
    );

  const directoryHeader = (
    <View className="gap-y-3 pb-2">
      <Input
        placeholder="Search location or business..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        icon={<Feather name="search" size={20} color={secondaryText} />}
      />
      <View className="flex-row items-center gap-2 flex-wrap">
        <Typography.Caption1 className="text-secondaryText">Sort:</Typography.Caption1>
        {(["rating", "price"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-full border ${
              sortBy === s
                ? "bg-primary border-primary"
                : "bg-background-secondary border-border"
            }`}
          >
            <Typography.Caption1
              className={sortBy === s ? "text-onPrimary capitalize" : "text-primaryText capitalize"}
            >
              {s}
            </Typography.Caption1>
          </Pressable>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {TRAILER_FILTERS.map((type) => {
          const active = filterTrailerType === type;
          const label =
            type === null ? "All types" : type.charAt(0).toUpperCase() + type.slice(1);
          return (
            <Pressable
              key={type ?? "all"}
              onPress={() => setFilterTrailerType(type)}
              className={`px-3 py-1.5 rounded-full border ${
                active
                  ? "bg-primary border-primary"
                  : "bg-background-secondary border-border"
              }`}
            >
              <Typography.Caption1
                className={
                  active ? "text-onPrimary" : "text-secondaryText"
                }
              >
                {label}
              </Typography.Caption1>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const showDirectoryLoader = tab === "directory" && haulersLoading && haulers.length === 0;
  const showTripsLoader = tab === "rideshare" && tripsLoading && trips.length === 0;
  const showMyLoader =
    tab === "my" &&
    (myTripsLoading || myReqLoading) &&
    myTrips.length === 0 &&
    myRequests.length === 0;

  if (showDirectoryLoader || showTripsLoader || showMyLoader) {
    return <Loader message="Loading…" />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenWrapper withoutTPadding withoutBPadding>
        <View className="flex-1 px-5 pt-4">
          <View className="mb-4">
            <TopTabs
              options={topTabOptions}
              selected={tab}
              onChange={onTabChange}
            />
          </View>

          {tab === "directory" ? (
            <FlatList
              data={filteredHaulers}
              keyExtractor={(item) => item.id}
              renderItem={renderHauler}
              ListHeaderComponent={directoryHeader}
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-28"
              refreshControl={
                <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <EmptyState
                  icon={
                    <Ionicons name="car-outline" size={40} color={secondaryText} />
                  }
                  message={
                    searchQuery.trim() || filterTrailerType
                      ? "No haulers match your filters."
                      : "No haulers in the directory yet."
                  }
                />
              }
            />
          ) : null}

          {tab === "rideshare" ? (
            <FlatList
              data={trips}
              keyExtractor={(item) => item.id}
              renderItem={renderTrip}
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-28"
              refreshControl={
                <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <EmptyState
                  icon={
                    <Ionicons name="car-outline" size={40} color={secondaryText} />
                  }
                  message="No upcoming trips. Post one to get started."
                />
              }
            />
          ) : null}

          {tab === "my" ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-28"
              refreshControl={
                <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <Typography.SubHeading2 className="text-primaryText mb-3">
                My posted trips
              </Typography.SubHeading2>
              {myTrips.length === 0 ? (
                <Typography.Body2 className="text-secondaryText mb-6">
                  You have not posted any trips yet.
                </Typography.Body2>
              ) : (
                myTrips.map((trip) => (
                  <View
                    key={trip.id}
                    className="bg-background-secondary rounded-2xl border border-border p-4 mb-3"
                  >
                    <Typography.SubHeading2 className="text-primaryText">
                      {tripEndpointLabel(trip, "origin")} →{" "}
                      {tripEndpointLabel(trip, "destination")}
                    </Typography.SubHeading2>
                    <Typography.Body2 className="text-secondaryText mt-1">
                      {new Date(trip.travel_date).toLocaleDateString()} · {trip.status}
                    </Typography.Body2>
                    <Typography.Caption1 className="text-secondaryText mt-1">
                      {trip.available_spots}/{trip.total_spots} spots available
                    </Typography.Caption1>

                    {trip.trip_requests.length > 0 ? (
                      <View className="mt-3 pt-3 border-t border-border gap-2">
                        <Typography.Caption1 className="text-primaryText font-poppins-medium">
                          Requests ({trip.trip_requests.length})
                        </Typography.Caption1>
                        {trip.trip_requests.map((req) => (
                          <View
                            key={req.id}
                            className="flex-row items-center justify-between gap-2"
                          >
                            <View className="flex-1 min-w-0">
                              <Typography.Body2 className="text-primaryText">
                                {req.requester?.name ?? "Unknown"}
                              </Typography.Body2>
                              <Typography.Caption1 className="text-secondaryText">
                                {req.num_horses} horse(s) · {req.status}
                              </Typography.Caption1>
                            </View>
                            {req.status === "pending" ? (
                              <View className="flex-row gap-2">
                                <Pressable
                                  onPress={() => void handleRespond(req.id, true)}
                                  className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center active:opacity-80"
                                >
                                  <Ionicons name="checkmark" size={22} color="#fff" />
                                </Pressable>
                                <Pressable
                                  onPress={() => void handleRespond(req.id, false)}
                                  className="w-10 h-10 rounded-full bg-red-500 items-center justify-center active:opacity-80"
                                >
                                  <Ionicons name="close" size={22} color="#fff" />
                                </Pressable>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              <Typography.SubHeading2 className="text-primaryText mt-4 mb-3">
                My trip requests
              </Typography.SubHeading2>
              {myRequests.length === 0 ? (
                <Typography.Body2 className="text-secondaryText">
                  You have not requested any trips yet.
                </Typography.Body2>
              ) : (
                myRequests.map((req) => (
                  <View
                    key={req.id}
                    className="bg-background-secondary rounded-2xl border border-border p-4 mb-3"
                  >
                    {req.trip ? (
                      <>
                        <Typography.Body2 className="text-primaryText">
                          {tripEndpointLabel(req.trip, "origin")} →{" "}
                          {tripEndpointLabel(req.trip, "destination")}
                        </Typography.Body2>
                        <Typography.Caption1 className="text-secondaryText mt-1">
                          Driver: {req.trip.driver?.name ?? "Unknown"}
                        </Typography.Caption1>
                        <Typography.Caption1 className="text-secondaryText">
                          {new Date(req.trip.travel_date).toLocaleDateString()} ·{" "}
                          {req.num_horses} horse(s)
                        </Typography.Caption1>
                        <Typography.Caption1 className="text-primaryText mt-2 capitalize">
                          {req.status}
                        </Typography.Caption1>
                      </>
                    ) : (
                      <Typography.Body2 className="text-secondaryText">
                        Trip no longer available.
                      </Typography.Body2>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </View>
      </ScreenWrapper>

      {tab === "directory" ? (
        <FloatingRoundedIconButton
          accessibilityLabel="Add hauler listing"
          icon={<Ionicons name="add" size={28} color="#ffffff" />}
          onPress={openNewHauler}
        />
      ) : null}

      {tab === "rideshare" ? (
        <FloatingRoundedIconButton
          accessibilityLabel="Post a trip"
          icon={<Ionicons name="add" size={28} color="#ffffff" />}
          onPress={() => router.push("/hauling/post-trip")}
        />
      ) : null}
    </View>
  );
};

export default HaulingScreen;
