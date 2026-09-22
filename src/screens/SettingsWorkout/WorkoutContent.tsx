import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  FloatingRoundedIconButton,
  SheetFormHeader,
  TopTabs,
} from "@/components";
import { useAuth } from "@/provider/AuthProvider";
import {
  useWorkoutLogs,
  type T_WORKOUT_TAB,
} from "@/services/supabase/useWorkoutLogs";
import type { T_WORKOUT_LOG } from "@/services/supabase/workoutTypes";
import { trackInteraction } from "@/analytics";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  workoutLogSchema,
  type T_WORKOUT_LOG_FORM,
} from "./workoutLogSchema";

const WORKOUT_TYPES = [
  "Riding",
  "Cardio",
  "Strength",
  "Stretching",
  "Arena work",
  "Trail",
  "Other",
] as const;

const INTENSITIES = ["light", "moderate", "hard", "max"] as const;

function getIntensityColor(intensity: string) {
  switch (intensity) {
    case "light":
      return "#10b981";
    case "moderate":
      return "#f59e0b";
    case "hard":
      return "#ef4444";
    case "max":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function WorkoutAddSheet({
  open,
  onClose,
  horses,
  initialFor,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  horses: { id: string; name: string }[];
  initialFor: T_WORKOUT_TAB;
  onSubmit: (values: T_WORKOUT_LOG_FORM) => Promise<void>;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const [form, setForm] = useState<T_WORKOUT_LOG_FORM>(() => ({
    workout_for: initialFor,
    horse_id: "",
    horse_name: "",
    workout_type: "Riding",
    duration_minutes: "",
    intensity: "moderate",
    calories_burned: "",
    notes: "",
  }));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        workout_for: initialFor,
        horse_id: "",
        horse_name: "",
      }));
      setFormError(null);
    }
  }, [open, initialFor]);

  if (!open) return null;

  const save = async () => {
    setFormError(null);
    try {
      const parsed = await workoutLogSchema.validate(form, { abortEarly: false });
      await onSubmit(parsed);
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setFormError(String((e as { message?: string }).message));
      } else {
        setFormError("Check your entries");
      }
    }
  };

  return (
    <View className="absolute inset-0 z-100 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[90%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader title="Add workout" onClose={onClose} />
        <ScrollView
          className="px-5 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Typography.SubHeading2 className="text-primaryText mb-2">For</Typography.SubHeading2>
          <View className="flex-row gap-3 mb-4">
            <Pressable
              onPress={() =>
                setForm((f) => ({ ...f, workout_for: "rider", horse_id: "", horse_name: "" }))
              }
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-2xl border ${
                form.workout_for === "rider"
                  ? "bg-primary border-primary"
                  : "bg-background-secondary border-border"
              }`}
            >
              <Ionicons
                name="person"
                size={20}
                color={form.workout_for === "rider" ? "#fff" : "#6b7280"}
              />
              <Typography.Body2
                className={
                  form.workout_for === "rider"
                    ? "text-white font-poppins-semibold"
                    : "text-secondaryText"
                }
              >
                Rider
              </Typography.Body2>
            </Pressable>
            <Pressable
              onPress={() => setForm((f) => ({ ...f, workout_for: "horse" }))}
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-2xl border ${
                form.workout_for === "horse"
                  ? "bg-primary border-primary"
                  : "bg-background-secondary border-border"
              }`}
            >
              <Ionicons
                name="paw"
                size={20}
                color={form.workout_for === "horse" ? "#fff" : "#6b7280"}
              />
              <Typography.Body2
                className={
                  form.workout_for === "horse"
                    ? "text-white font-poppins-semibold"
                    : "text-secondaryText"
                }
              >
                Horse
              </Typography.Body2>
            </Pressable>
          </View>

          {form.workout_for === "horse" ? (
            <View className="mb-4">
              <Typography.SubHeading2 className="text-primaryText mb-2">
                Horse
              </Typography.SubHeading2>
              {horses.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {horses.map((h) => {
                    const active = form.horse_id === h.id;
                    return (
                      <Pressable
                        key={h.id}
                        onPress={() =>
                          setForm((f) => ({
                            ...f,
                            horse_id: h.id,
                            horse_name: h.name,
                          }))
                        }
                        className={`px-4 py-2 rounded-full border ${
                          active
                            ? "bg-primary border-primary"
                            : "bg-background-secondary border-border"
                        }`}
                      >
                        <Typography.Caption1
                          className={
                            active
                              ? "text-white font-poppins-semibold"
                              : "text-primaryText"
                          }
                        >
                          {h.name}
                        </Typography.Caption1>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
                  <TextInput
                    placeholder="Horse name"
                    value={form.horse_name}
                    onChangeText={(text) =>
                      setForm((f) => ({
                        ...f,
                        horse_name: text,
                        horse_id: "",
                      }))
                    }
                    placeholderTextColor="#9ca3af"
                    className={`text-base text-primaryText ${form.horse_name ? "font-poppins-medium" : ""}`}
                  />
                </View>
              )}
            </View>
          ) : null}

          <Typography.SubHeading2 className="text-primaryText mb-2">
            Workout type
          </Typography.SubHeading2>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {WORKOUT_TYPES.map((t) => {
              const active = form.workout_type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setForm((f) => ({ ...f, workout_type: t }))}
                  className={`px-3 py-2 rounded-full border ${
                    active
                      ? "bg-primary border-primary"
                      : "bg-background-secondary border-border"
                  }`}
                >
                  <Typography.Caption1
                    className={
                      active
                        ? "text-white font-poppins-semibold"
                        : "text-primaryText"
                    }
                  >
                    {t}
                  </Typography.Caption1>
                </Pressable>
              );
            })}
          </ScrollView>

          <Typography.SubHeading2 className="text-primaryText mb-2">
            Duration (minutes) *
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border mb-4">
            <TextInput
              placeholder="e.g. 45"
              value={form.duration_minutes}
              onChangeText={(text) =>
                setForm((f) => ({ ...f, duration_minutes: text }))
              }
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
              className={`text-base text-primaryText ${form.duration_minutes ? "font-poppins-medium" : ""}`}
            />
          </View>

          <Typography.SubHeading2 className="text-primaryText mb-2">
            Intensity
          </Typography.SubHeading2>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {INTENSITIES.map((i) => {
              const active = form.intensity === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => setForm((f) => ({ ...f, intensity: i }))}
                  className={`px-3 py-2 rounded-full border ${
                    active
                      ? "bg-primary border-primary"
                      : "bg-background-secondary border-border"
                  }`}
                >
                  <Typography.Caption1
                    className={
                      active
                        ? "text-white font-poppins-semibold capitalize"
                        : "text-primaryText capitalize"
                    }
                  >
                    {i}
                  </Typography.Caption1>
                </Pressable>
              );
            })}
          </View>

          <Typography.SubHeading2 className="text-primaryText mb-2">
            Calories burned (optional)
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border mb-4">
            <TextInput
              placeholder="0"
              value={form.calories_burned}
              onChangeText={(text) =>
                setForm((f) => ({ ...f, calories_burned: text }))
              }
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
              className={`text-base text-primaryText ${form.calories_burned ? "font-poppins-medium" : ""}`}
            />
          </View>

          <Typography.SubHeading2 className="text-primaryText mb-2">
            Notes (optional)
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-2xl px-4 py-3 border border-border mb-4 min-h-[88px]">
            <TextInput
              placeholder="Notes…"
              value={form.notes}
              onChangeText={(text) => setForm((f) => ({ ...f, notes: text }))}
              multiline
              placeholderTextColor="#9ca3af"
              className={`text-base text-primaryText min-h-[72px] ${form.notes ? "font-poppins-medium" : ""}`}
            />
          </View>

          {formError ? (
            <Typography.Body2 className="text-danger mb-3">{formError}</Typography.Body2>
          ) : null}

          <Button
            title="Add workout"
            onPress={() => void save()}
            loading={submitting}
          />
        </ScrollView>
      </View>
    </View>
  );
}

export type WorkoutContentProps = {
  compactHeader?: boolean;
};

export default function WorkoutContent({
  compactHeader = false,
}: WorkoutContentProps) {
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<T_WORKOUT_TAB>("rider");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    workoutLogs,
    horses,
    loading,
    refreshing: hookRefreshing,
    loadHorses,
    loadWorkouts,
    insertWorkout,
  } = useWorkoutLogs(profile?.id, selectedDate, tab);

  useEffect(() => {
    void loadWorkouts(false);
  }, [loadWorkouts]);

  useEffect(() => {
    if (tab === "horse") void loadHorses();
  }, [tab, loadHorses]);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const onSubmit = async (values: T_WORKOUT_LOG_FORM) => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      const duration = parseInt(values.duration_minutes, 10);
      const logData: Record<string, unknown> = {
        user_id: profile.id,
        workout_date: selectedDate,
        workout_for: values.workout_for,
        workout_type: values.workout_type,
        duration_minutes: duration,
        intensity: values.intensity,
        calories_burned: values.calories_burned.trim()
          ? parseInt(values.calories_burned, 10)
          : null,
        notes: values.notes.trim() || null,
      };
      if (values.workout_for === "horse") {
        logData.horse_id = values.horse_id || null;
        logData.horse_name =
          values.horse_name.trim() ||
          horses.find((h) => h.id === values.horse_id)?.name ||
          "My Horse";
      }

      await insertWorkout(logData);
      void trackInteraction("training_workout", "workout_logged", {
        workout_for: values.workout_for,
        workout_type: values.workout_type,
      });
      Alert.alert("Success", "Workout added");
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to add workout",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = useCallback(() => {
    void loadWorkouts(true);
  }, [loadWorkouts]);

  const openSheet = () => {
    setSheetOpen(true);
  };

  const showLoader = loading && workoutLogs.length === 0;

  if (showLoader) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading workouts…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background relative">
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <TopTabs
          options={[
            { label: "Rider", value: "rider" },
            { label: "Horse", value: "horse" },
          ]}
          selected={tab}
          onChange={(v) => setTab(v as T_WORKOUT_TAB)}
        />
      </View>

      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-background-secondary">
        <Pressable onPress={() => changeDate(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </Pressable>
        <Typography.Body2 className="text-primaryText font-poppins-semibold">
          {formatDate(selectedDate)}
        </Typography.Body2>
        <Pressable onPress={() => changeDate(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={primaryColor} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <AppRefreshControl refreshing={hookRefreshing} onRefresh={onRefresh} />
        }
      >
        {workoutLogs.length === 0 ? (
          <View className="items-center py-16 px-4">
            <Ionicons name="barbell-outline" size={64} color="#d1d5db" />
            <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
              No workouts for this day
            </Typography.SubHeading1>
            <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
              Tap the + button to log a workout for this date.
            </Typography.Body2>
          </View>
        ) : (
          workoutLogs.map((log: T_WORKOUT_LOG) => (
            <View
              key={log.id}
              className="bg-card border border-border rounded-2xl p-4 mb-3"
            >
              <View className="flex-row justify-between items-center mb-3">
                <Typography.Body2 className="text-primaryText font-poppins-semibold capitalize">
                  {log.workout_type}
                </Typography.Body2>
                <View
                  className="px-2 py-1 rounded-lg"
                  style={{ backgroundColor: getIntensityColor(log.intensity) }}
                >
                  <Typography.Caption1 className="text-white font-poppins-bold uppercase">
                    {log.intensity}
                  </Typography.Caption1>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time" size={16} color="#6b7280" />
                  <Typography.Body2 className="text-secondaryText">
                    {log.duration_minutes} min
                  </Typography.Body2>
                </View>
                {log.calories_burned != null && log.calories_burned > 0 ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="flame" size={16} color="#ef4444" />
                    <Typography.Body2 className="text-secondaryText">
                      {log.calories_burned} cal
                    </Typography.Body2>
                  </View>
                ) : null}
              </View>
              {log.horse_name ? (
                <View className="flex-row items-center gap-1 mt-2">
                  <Ionicons name="paw" size={16} color="#6b7280" />
                  <Typography.Body2 className="text-secondaryText">
                    {log.horse_name}
                  </Typography.Body2>
                </View>
              ) : null}
              {log.notes ? (
                <Typography.Body2 className="text-secondaryText mt-2">
                  {log.notes}
                </Typography.Body2>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <FloatingRoundedIconButton
        icon={<Ionicons name="add" size={28} color="#fff" />}
        onPress={openSheet}
        accessibilityLabel="Add workout"
      />

      <WorkoutAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        horses={horses}
        initialFor={tab}
        onSubmit={onSubmit}
        submitting={submitting}
      />
    </View>
  );
}
