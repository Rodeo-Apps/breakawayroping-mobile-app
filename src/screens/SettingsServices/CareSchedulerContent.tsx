import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  Dropdown,
  Input,
  SheetFormHeader,
  TopTabs,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  useCareScheduler,
  type T_CARE_EVENT_ROW,
  type T_NEW_CARE_EVENT,
  type T_VIEW_MODE,
} from "@/services/supabase/useCareScheduler";
import { useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EVENT_TYPES: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { value: "feeding", label: "Feeding", icon: "restaurant", color: "#10b981" },
  { value: "vet", label: "Vet", icon: "medical", color: "#ef4444" },
  { value: "farrier", label: "Farrier", icon: "hammer", color: "#f59e0b" },
  { value: "vaccine", label: "Vaccine", icon: "shield-checkmark", color: "#3b82f6" },
  { value: "grooming", label: "Grooming", icon: "cut", color: "#8b5cf6" },
  { value: "training", label: "Training", icon: "fitness", color: "#06b6d4" },
  { value: "medication", label: "Medication", icon: "medkit", color: "#ec4899" },
  { value: "custom", label: "Custom", icon: "ellipsis-horizontal", color: "#6b7280" },
];

function typeMeta(type: string) {
  return EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

export default function CareSchedulerContent() {
  useTrackScreenFocus("care_scheduler");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id;

  const {
    horses,
    events,
    loading,
    refresh,
    createEvent,
    deleteEvent,
    markComplete,
  } = useCareScheduler(userId);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<T_VIEW_MODE>("week");
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<T_NEW_CARE_EVENT>(() => ({
    horse_id: "",
    event_type: "custom",
    title: "",
    description: "",
    scheduled_date: new Date().toISOString().split("T")[0],
    scheduled_time: "09:00",
    duration_minutes: 60,
    status: "scheduled",
    is_recurring: false,
    reminder_enabled: true,
    provider_name: "",
    cost_cents: 0,
  }));

  useEffect(() => {
    if (!userId) return;
    void refresh(selectedDate, viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh identity changes each render
  }, [userId, selectedDate, viewMode]);

  useEffect(() => {
    if (horses.length && !form.horse_id) {
      setForm((f) => ({ ...f, horse_id: horses[0].id }));
    }
  }, [horses, form.horse_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh(selectedDate, viewMode);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, selectedDate, viewMode]);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d);
  };

  const submit = useCallback(async () => {
    if (!form.title.trim()) {
      Alert.alert("Missing", "Enter a title.");
      return;
    }
    if (!form.horse_id) {
      Alert.alert("Missing", "Add a horse first.");
      return;
    }
    setSaving(true);
    try {
      await createEvent(form);
      setModalOpen(false);
      setForm((f) => ({
        ...f,
        title: "",
        description: "",
        cost_cents: 0,
      }));
      await refresh(selectedDate, viewMode);
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not create event",
      );
    } finally {
      setSaving(false);
    }
  }, [form, createEvent, refresh, selectedDate, viewMode]);

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete event", "Remove this scheduled care event?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(id);
              await refresh(selectedDate, viewMode);
            } catch (e: unknown) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Delete failed",
              );
            }
          },
        },
      ]);
    },
    [deleteEvent, refresh, selectedDate, viewMode],
  );

  const horseOptions = horses.map((h) => ({ label: h.name, value: h.id }));
  const typeOptions = EVENT_TYPES.map((t) => ({ label: t.label, value: t.value }));

  if (loading && events.length === 0 && horses.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading schedule…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-border bg-background-secondary">
        <Pressable onPress={() => navigateDate(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </Pressable>
        <Typography.Body2 className="text-primaryText font-poppins-semibold">
          {selectedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Typography.Body2>
        <Pressable onPress={() => navigateDate(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={primaryColor} />
        </Pressable>
      </View>

      <View className="px-5 py-3 border-b border-border bg-background-secondary">
        <TopTabs
          options={[
            { label: "Day", value: "day" },
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
          selected={viewMode}
          onChange={(v) => setViewMode(v as T_VIEW_MODE)}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 88,
        }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-y-4">
          <Typography.Body2 className="text-secondaryText">
            Schedule vet visits, farrier, feeding, and other horse care. Mark items
            complete when done.
          </Typography.Body2>

          {events.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
              <Typography.Body2 className="text-secondaryText mt-3 text-center">
                No events in this range
              </Typography.Body2>
            </View>
          ) : (
            events.map((ev: T_CARE_EVENT_ROW) => {
              const meta = typeMeta(ev.event_type);
              return (
                <View
                  key={ev.id}
                  className="bg-background-secondary border border-border rounded-2xl overflow-hidden flex-row"
                >
                  <View className="w-1" style={{ backgroundColor: meta.color }} />
                  <View className="flex-1 p-4 gap-y-2">
                    <View className="flex-row justify-between items-start gap-x-2">
                      <View className="flex-row items-center gap-x-2 flex-1">
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                        <View className="flex-1 min-w-0">
                          <Typography.Body2 className="text-primaryText font-poppins-semibold">
                            {ev.title}
                          </Typography.Body2>
                          <Typography.Caption1 className="text-secondaryText">
                            {ev.horses?.name ?? "Horse"} · {ev.scheduled_date}
                            {ev.scheduled_time ? ` · ${ev.scheduled_time}` : ""}
                          </Typography.Caption1>
                        </View>
                      </View>
                      <View className="flex-row gap-x-2">
                        {ev.status !== "completed" ? (
                          <Pressable
                            onPress={async () => {
                              if (!userId) return;
                              try {
                                await markComplete(ev.id, userId);
                                await refresh(selectedDate, viewMode);
                              } catch (e: unknown) {
                                Alert.alert(
                                  "Error",
                                  e instanceof Error ? e.message : "Update failed",
                                );
                              }
                            }}
                            hitSlop={8}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={26}
                              color="#10b981"
                            />
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => confirmDelete(ev.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={22} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View
        className="absolute right-5"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={() => setModalOpen(true)}
          className="w-14 h-14 rounded-full bg-primary items-center justify-center shadow-md active:opacity-90"
          accessibilityLabel="Add care event"
        >
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </View>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        onRequestClose={() => setModalOpen(false)}
      >
        <View className="flex-1 bg-background">
          <SheetFormHeader
            title="Add care event"
            onClose={() => setModalOpen(false)}
          />
          <KeyboardAwareScrollView
            className="px-5 py-6"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View className="gap-y-6">
              {horseOptions.length ? (
                <Dropdown
                  label="Horse"
                  placeholder="Select horse"
                  value={form.horse_id}
                  onChangeValue={(v) =>
                    setForm((f) => ({
                      ...f,
                      horse_id: typeof v === "string" ? v : f.horse_id,
                    }))
                  }
                  options={horseOptions}
                />
              ) : (
                <Typography.Body2 className="text-warning">
                  Add a horse to your account to schedule care.
                </Typography.Body2>
              )}
              <Dropdown
                label="Type"
                value={form.event_type}
                onChangeValue={(v) =>
                  setForm((f) => ({
                    ...f,
                    event_type: typeof v === "string" ? v : f.event_type,
                  }))
                }
                options={typeOptions}
              />
              <Input
                label="Title *"
                value={form.title}
                onChangeText={(text) => setForm((f) => ({ ...f, title: text }))}
              />
              <Input
                label="Description"
                value={form.description}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, description: text }))
                }
              />
              <Input
                label="Date (YYYY-MM-DD)"
                value={form.scheduled_date}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, scheduled_date: text }))
                }
              />
              <Input
                label="Time (HH:MM)"
                value={form.scheduled_time}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, scheduled_time: text }))
                }
              />
              <Input
                label="Cost (USD)"
                value={form.cost_cents ? String(form.cost_cents) : ""}
                onChangeText={(text) =>
                  setForm((f) => ({
                    ...f,
                    cost_cents: text.trim() ? parseFloat(text) : 0,
                  }))
                }
                inputProps={{ keyboardType: "decimal-pad" }}
              />
              <Button
                title="Save event"
                loading={saving}
                onPress={() => void submit()}
              />
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}
