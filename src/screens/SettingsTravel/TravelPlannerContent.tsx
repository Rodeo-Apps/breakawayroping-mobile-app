import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  FloatingRoundedIconButton,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useTravelPlans } from "@/services/supabase/useTravelPlans";
import type { T_TRAVEL_PLAN_ROW, T_TRAVEL_STOP_ROW } from "@/services/supabase/travelTypes";
import { useTrackScreenFocus, trackInteraction } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openGoogleMapsDirections } from "@/utils/googleMaps";
import CreateTravelPlanModal from "./CreateTravelPlanModal";

function formatDate(dateString: string | null) {
  if (!dateString) return "Date TBD";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCost(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusHex(status: string) {
  switch (status) {
    case "planned":
      return "#3b82f6";
    case "in_progress":
      return "#f59e0b";
    case "completed":
      return "#10b981";
    case "cancelled":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function stopIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "gas":
      return "water";
    case "food":
      return "restaurant";
    case "rest":
      return "bed";
    case "lodging":
      return "home";
    case "event":
      return "calendar";
    case "attraction":
      return "camera";
    default:
      return "location";
  }
}

export default function TravelPlannerContent() {
  useTrackScreenFocus("trip_plan");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const successColor = useCSSVariable("--color-success") as string;
  const { profile } = useAuth();
  const userId = profile?.id;

  const {
    plans,
    loading,
    refresh,
    createPlan,
    addStop,
    updateStatus,
    stopTypes,
  } = useTravelPlans(userId);

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const submitCreate = useCallback(
    async (payload: Parameters<typeof createPlan>[0]) => {
      setSaving(true);
      try {
        const row = await createPlan(payload);
        void trackInteraction("trip_plan", "plan_created", { plan_id: row.id });
        setCreateOpen(false);
        await refresh();
      } catch (e: unknown) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Could not create travel plan.",
        );
      } finally {
        setSaving(false);
      }
    },
    [createPlan, refresh],
  );

  const promptAddStop = useCallback(
    (planId: string) => {
      Alert.alert("Add stop", "Choose a stop type", [
        ...stopTypes.map((type) => ({
          text: type.charAt(0).toUpperCase() + type.slice(1),
          onPress: async () => {
            try {
              await addStop(planId, type);
              void trackInteraction("trip_plan", "stop_added", {
                plan_id: planId,
                stop_type: type,
              });
            } catch (e: unknown) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to add stop",
              );
            }
          },
        })),
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [addStop, stopTypes],
  );

  const handleStatus = useCallback(
    async (planId: string, newStatus: string) => {
      try {
        await updateStatus(planId, newStatus);
        void trackInteraction("trip_plan", "status_update", {
          plan_id: planId,
          status: newStatus,
        });
      } catch (e: unknown) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Failed to update status",
        );
      }
    },
    [updateStatus],
  );

  const openDirections = useCallback((plan: T_TRAVEL_PLAN_ROW) => {
    openGoogleMapsDirections(plan.end_location, plan.start_location);
  }, []);

  if (loading && plans.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading travel plans…
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
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-y-6">
          <Typography.Body2 className="text-secondaryText">
            Plan trips to events, add fuel and rest stops, and open turn-by-turn
            directions when you are ready to roll.
          </Typography.Body2>

          {plans.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="map-outline" size={64} color="#d1d5db" />
              <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
                No travel plans
              </Typography.SubHeading1>
              <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
                Create your first trip to see the route, distance, and stops
                here.
              </Typography.Body2>
            </View>
          ) : (
            plans.map((plan) => (
              <View
                key={plan.id}
                className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-3"
              >
                <View className="gap-y-2">
                  <View className="flex-row justify-between items-start gap-x-3">
                    <Typography.Body2 className="text-primaryText font-poppins-semibold flex-1">
                      {plan.title}
                    </Typography.Body2>
                    <View
                      className="px-2 py-1 rounded-lg shrink-0"
                      style={{ backgroundColor: statusHex(plan.travel_status) }}
                    >
                      <Typography.Caption1 className="text-white font-poppins-bold uppercase">
                        {plan.travel_status.replace(/_/g, " ")}
                      </Typography.Caption1>
                    </View>
                  </View>
                  {plan.event_name ? (
                    <View className="flex-row items-center gap-x-2 self-start bg-primary/10 px-3 py-1 rounded-full">
                      <Ionicons name="calendar" size={14} color={primaryColor} />
                      <Typography.Caption1 className="text-primary font-poppins-semibold">
                        {plan.event_name}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                </View>

                <View className="pl-2 gap-y-1">
                  <View className="flex-row items-center gap-x-3">
                    <View className="w-3 h-3 rounded-full bg-success" />
                    <Typography.Body2 className="text-primaryText flex-1 font-poppins-medium">
                      {plan.start_location}
                    </Typography.Body2>
                  </View>
                  <View className="w-0.5 h-4 bg-border ml-1.5" />
                  {(plan.stops ?? []).map((stop: T_TRAVEL_STOP_ROW) => (
                    <View key={stop.id}>
                      <View className="flex-row items-center gap-x-3">
                        <View
                          className={`w-6 h-6 rounded-full items-center justify-center ${
                            stop.is_completed ? "bg-success/20" : "bg-background"
                          }`}
                        >
                          <Ionicons
                            name={stopIcon(stop.stop_type)}
                            size={12}
                            color={stop.is_completed ? successColor : "#6b7280"}
                          />
                        </View>
                        <View className="flex-1">
                          <Typography.Body2 className="text-primaryText">
                            {stop.name}
                          </Typography.Body2>
                          <Typography.Caption1 className="text-secondaryText">
                            {stop.estimated_duration_minutes} min
                            {stop.cost_estimate_cents
                              ? ` · ${formatCost(stop.cost_estimate_cents)}`
                              : ""}
                          </Typography.Caption1>
                        </View>
                      </View>
                      <View className="w-0.5 h-4 bg-border ml-3" />
                    </View>
                  ))}
                  <View className="flex-row items-center gap-x-3">
                    <View className="w-3 h-3 rounded-full bg-danger shrink-0" />
                    <Typography.Body2 className="text-primaryText flex-1 font-poppins-medium">
                      {plan.end_location}
                    </Typography.Body2>
                  </View>
                </View>

                <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                  <View className="flex-row items-center gap-x-2">
                    <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                    <Typography.Body2 className="text-secondaryText">
                      {formatDate(plan.departure_date)}
                    </Typography.Body2>
                  </View>
                  {plan.total_distance_miles != null ? (
                    <View className="flex-row items-center gap-x-2">
                      <Ionicons name="speedometer-outline" size={16} color="#6b7280" />
                      <Typography.Body2 className="text-secondaryText">
                        {plan.total_distance_miles} mi
                      </Typography.Body2>
                    </View>
                  ) : null}
                  {plan.estimated_fuel_cost_cents ? (
                    <View className="flex-row items-center gap-x-2">
                      <Ionicons name="cash-outline" size={16} color="#6b7280" />
                      <Typography.Body2 className="text-secondaryText">
                        {formatCost(plan.estimated_fuel_cost_cents)}
                      </Typography.Body2>
                    </View>
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => openDirections(plan)}
                    className="flex-row items-center gap-x-2 px-3 py-2 rounded-xl border border-border bg-background active:opacity-80"
                  >
                    <Ionicons name="navigate" size={18} color={successColor} />
                    <Typography.Body2 className="font-poppins-semibold text-success">
                      Directions
                    </Typography.Body2>
                  </Pressable>
                  <Pressable
                    onPress={() => promptAddStop(plan.id)}
                    className="flex-row items-center gap-x-2 px-3 py-2 rounded-xl border border-border bg-background active:opacity-80"
                  >
                    <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
                    <Typography.Body2 className="text-primary font-poppins-semibold">
                      Add stop
                    </Typography.Body2>
                  </Pressable>
                  {plan.travel_status === "planned" ? (
                    <Pressable
                      onPress={() => void handleStatus(plan.id, "in_progress")}
                      className="flex-row items-center gap-x-2 px-3 py-2 rounded-xl bg-warning active:opacity-90"
                    >
                      <Ionicons name="play" size={18} color="#fff" />
                      <Typography.Body2 className="text-white font-poppins-semibold">
                        Start trip
                      </Typography.Body2>
                    </Pressable>
                  ) : null}
                  {plan.travel_status === "in_progress" ? (
                    <Pressable
                      onPress={() => void handleStatus(plan.id, "completed")}
                      className="flex-row items-center gap-x-2 px-3 py-2 rounded-xl bg-success active:opacity-90"
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Typography.Body2 className="text-white font-poppins-semibold">
                        Complete
                      </Typography.Body2>
                    </Pressable>
                  ) : null}
                </View>

                {plan.weather_data &&
                Object.keys(plan.weather_data).length > 0 ? (
                  <View className="flex-row items-center gap-x-2 bg-primary/10 rounded-xl px-3 py-2">
                    <Ionicons name="cloud" size={18} color={primaryColor} />
                    <Typography.Body2 className="text-primary">
                      Weather data available
                    </Typography.Body2>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FloatingRoundedIconButton
        icon={<Ionicons name="add" size={28} color="#fff" />}
        onPress={() => setCreateOpen(true)}
        accessibilityLabel="Create travel plan"
      />

      <CreateTravelPlanModal
        visible={createOpen}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onCreate={submitCreate}
      />
    </View>
  );
}
