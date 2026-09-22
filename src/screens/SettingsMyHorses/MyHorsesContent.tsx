import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppRefreshControl, Button, TopTabs } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  canAddHorseOnFreeTier,
  FREE_TIER_MAX_HORSES,
  hasActivePremiumAccess,
} from "@/utils/premiumEntitlement";
import { useMyHorses } from "@/services/supabase/useMyHorses";
import type { T_MY_HORSE_ROW } from "@/services/supabase/horseTypes";
import { trackInteraction, useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveHorsePhotoUrl } from "@/utils/horsePhotos";

type Filter = "all" | "active" | "retired";

function formatTime(seconds?: number) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  return `${seconds.toFixed(2)}s`;
}

export default function MyHorsesContent() {
  useTrackScreenFocus("horses");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { profile } = useAuth();
  const userId = profile?.id;

  const { horses, loading, refresh, deleteHorse } = useMyHorses(userId);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useFocusEffect(
    useCallback(() => {
      if (userId) void refresh();
    }, [userId, refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const filteredHorses = useMemo(() => {
    if (filter === "all") return horses;
    if (filter === "active") return horses.filter((h) => h.is_active === true);
    return horses.filter((h) => h.is_active === false || h.is_active == null);
  }, [horses, filter]);

  const counts = useMemo(() => {
    const active = horses.filter((h) => h.is_active).length;
    const retired = horses.filter(
      (h) => h.is_active === false || h.is_active == null,
    ).length;
    return { all: horses.length, active, retired };
  }, [horses]);

  const filterTabOptions = useMemo(
    () => [
      { label: `All (${counts.all})`, value: "all" },
      { label: `Active (${counts.active})`, value: "active" },
      { label: `Retired (${counts.retired})`, value: "retired" },
    ],
    [counts.all, counts.active, counts.retired],
  );

  const openAdd = useCallback(() => {
    if (!profile?.id) return;
    if (
      !canAddHorseOnFreeTier(
        hasActivePremiumAccess(profile),
        horses.length,
      )
    ) {
      Alert.alert(
        "Horse limit reached",
        `Free accounts can include up to ${FREE_TIER_MAX_HORSES} horse profiles. Upgrade to Premium to add more.`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "View plans",
            onPress: () => router.push("/subscription-plans"),
          },
        ],
      );
      return;
    }
    void trackInteraction("horses", "add_horse_open", {});
    router.push("/add-horse");
  }, [horses.length, profile, router]);

  const openEdit = useCallback(
    (horseId: string) => {
      router.push({
        pathname: "/add-horse",
        params: { horseId },
      });
    },
    [router],
  );

  const confirmDelete = useCallback(
    (horse: T_MY_HORSE_ROW) => {
      Alert.alert(
        "Delete horse",
        `Remove ${horse.name}? This will also delete associated runs and data.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteHorse(horse.id);
                void trackInteraction("horse", "horse_delete", {
                  horse_id: horse.id,
                });
                await refresh();
              } catch (e: unknown) {
                Alert.alert(
                  "Error",
                  e instanceof Error ? e.message : "Failed to delete horse",
                );
              }
            },
          },
        ],
      );
    },
    [deleteHorse, refresh],
  );

  const setFilterTracked = useCallback((f: Filter) => {
    void trackInteraction("horses", "filter", { filter: f });
    setFilter(f);
  }, []);

  if (loading && horses.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading horses…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void trackInteraction("horses", "pull_refresh", {});
              void onRefresh();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-y-6">
          <TopTabs
            options={filterTabOptions}
            selected={filter}
            onChange={(v) => setFilterTracked(v as Filter)}
          />
          <Typography.Body2 className="text-secondaryText">
            Manage horses you own or added to your account. Tap a horse to edit
            details, photos, and status.
          </Typography.Body2>

          {filteredHorses.length === 0 ? (
            <View className="items-center py-12">
              <MaterialCommunityIcons name="horse" size={64} color="#d1d5db" />
              <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
                No horses yet
              </Typography.SubHeading1>
              <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
                {filter === "all"
                  ? "Add your first horse to start tracking performance and runs."
                  : `No ${filter} horses found.`}
              </Typography.Body2>
              {filter === "all" ? (
                <View className="mt-6">
                  <Button
                    title="Add horse"
                    onPress={() => {
                      void trackInteraction("horses", "add_horse_open", {
                        source: "empty",
                      });
                      openAdd();
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            filteredHorses.map((horse) => {
              const photoUri = resolveHorsePhotoUrl(horse.primary_photo);
              const perf = horse.horse_performance;
              const showStats =
                perf != null && perf.total_runs != null && perf.total_runs > 0;

              return (
                <View
                  key={horse.id}
                  className="bg-background-secondary border border-border rounded-2xl overflow-hidden"
                >
                  <Pressable
                    onPress={() => openEdit(horse.id)}
                    className="flex-row items-center p-4 gap-x-3 active:opacity-90"
                  >
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        className="w-20 h-20 rounded-xl bg-background"
                      />
                    ) : (
                      <View className="w-20 h-20 rounded-xl bg-background items-center justify-center">
                        <MaterialCommunityIcons
                          name="horse"
                          size={32}
                          color="#9ca3af"
                        />
                      </View>
                    )}
                    <View className="flex-1 min-w-0 gap-y-1">
                      <View className="flex-row items-center gap-x-2 flex-wrap">
                        <Typography.Body2 className="text-primaryText font-poppins-bold text-lg">
                          {horse.name}
                        </Typography.Body2>
                        {!horse.is_active ? (
                          <View className="bg-warning/20 px-2 py-0.5 rounded-md">
                            <Typography.Caption1 className="text-warning font-poppins-semibold">
                              Retired
                            </Typography.Caption1>
                          </View>
                        ) : null}
                      </View>
                      {horse.breed ? (
                        <View className="flex-row items-center gap-x-2">
                          <Ionicons name="paw" size={14} color="#6b7280" />
                          <Typography.Body2 className="text-secondaryText">
                            {horse.breed}
                          </Typography.Body2>
                        </View>
                      ) : null}
                      {horse.age != null ? (
                        <View className="flex-row items-center gap-x-2">
                          <Ionicons name="calendar" size={14} color="#6b7280" />
                          <Typography.Body2 className="text-secondaryText">
                            {horse.age} years old
                          </Typography.Body2>
                        </View>
                      ) : null}
                      {horse.gender ? (
                        <View className="flex-row items-center gap-x-2">
                          <Ionicons
                            name={horse.gender === "mare" ? "female" : "male"}
                            size={14}
                            color="#6b7280"
                          />
                          <Typography.Body2 className="text-secondaryText capitalize">
                            {horse.gender}
                          </Typography.Body2>
                        </View>
                      ) : null}
                      {hasActivePremiumAccess(profile) &&
                      (horse.sire_name || horse.dam_name) ? (
                        <View className="flex-row items-center gap-x-2 mt-1 pt-2 border-t border-border">
                          <Ionicons
                            name="git-network"
                            size={14}
                            color="#10b981"
                          />
                          <Typography.Caption1 className="text-success font-poppins-medium flex-1">
                            {horse.sire_name ?? "Unknown"} ×{" "}
                            {horse.dam_name ?? "Unknown"}
                          </Typography.Caption1>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#d1d5db"
                    />
                  </Pressable>

                  {showStats ? (
                    <View className="flex-row border-t border-border bg-background py-4 px-4">
                      <View className="flex-1 items-center">
                        <Typography.Body2 className="text-primaryText font-poppins-bold text-lg tabular-nums">
                          {perf!.total_runs}
                        </Typography.Body2>
                        <Typography.Caption1 className="text-secondaryText">
                          Runs
                        </Typography.Caption1>
                      </View>
                      <View className="w-px bg-border" />
                      <View className="flex-1 items-center">
                        <Typography.Body2 className="text-primaryText font-poppins-bold text-lg tabular-nums">
                          {formatTime(perf!.best_time)}
                        </Typography.Body2>
                        <Typography.Caption1 className="text-secondaryText">
                          Best
                        </Typography.Caption1>
                      </View>
                      <View className="w-px bg-border" />
                      <View className="flex-1 items-center">
                        <Typography.Body2 className="text-primaryText font-poppins-bold text-lg tabular-nums">
                          {formatTime(perf!.average_time)}
                        </Typography.Body2>
                        <Typography.Caption1 className="text-secondaryText">
                          Avg
                        </Typography.Caption1>
                      </View>
                    </View>
                  ) : null}

                  <View className="flex-row border-t border-border p-3 gap-2">
                    <Pressable
                      onPress={() => openEdit(horse.id)}
                      className="flex-1 flex-row items-center justify-center gap-x-2 py-2.5 rounded-xl bg-primary/10 active:opacity-80"
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color={primaryColor}
                      />
                      <Typography.Body2 className="text-primary font-poppins-semibold">
                        Edit
                      </Typography.Body2>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(horse)}
                      className="flex-1 flex-row items-center justify-center gap-x-2 py-2.5 rounded-xl bg-danger/10 active:opacity-80"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#ef4444"
                      />
                      <Typography.Body2 className="text-danger font-poppins-semibold">
                        Delete
                      </Typography.Body2>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
