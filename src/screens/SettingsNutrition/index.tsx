import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  FloatingRoundedIconButton,
  ScreenWrapper,
  SheetFormHeader,
  TopTabs,
} from "@/components";
import StatMetricCard from "@/components/ui/StatMetricCard";
import { useAuth } from "@/provider/AuthProvider";
import {
  useNutritionLogs,
  type T_NUTRITION_TAB,
} from "@/services/supabase/useNutritionLogs";
import type { T_NUTRITION_LOG } from "@/services/supabase/nutritionTypes";
import { trackInteraction } from "@/analytics";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  nutritionLogSchema,
  type T_NUTRITION_LOG_FORM,
} from "./nutritionLogSchema";

const QUICK_ADD_TEMPLATES: Array<{
  label: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}> = [
  { label: "Snack", calories: "200", protein: "", carbs: "", fat: "" },
  { label: "Meal", calories: "500", protein: "", carbs: "", fat: "" },
  {
    label: "Protein Shake",
    calories: "160",
    protein: "30",
    carbs: "5",
    fat: "3",
  },
  { label: "Water", calories: "0", protein: "", carbs: "", fat: "" },
  { label: "Treat", calories: "250", protein: "", carbs: "", fat: "" },
  { label: "Horse Feed", calories: "", protein: "", carbs: "", fat: "" },
  { label: "Supplement", calories: "", protein: "", carbs: "", fat: "" },
];

function logLabel(log: T_NUTRITION_LOG) {
  return log.food_name || log.item_name || "Entry";
}

function NutritionAddSheet({
  open,
  onClose,
  tab,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  tab: T_NUTRITION_TAB;
  onSubmit: (values: T_NUTRITION_LOG_FORM) => Promise<void>;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<T_NUTRITION_LOG_FORM>({
    item_name: "",
    meal_type: "meal",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm({
        item_name: "",
        meal_type: "meal",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      });
      setFormError(null);
    }
  }, [open]);

  if (!open) return null;

  const applyTemplate = (t: (typeof QUICK_ADD_TEMPLATES)[0]) => {
    setForm((prev) => ({
      ...prev,
      item_name: t.label,
      calories: t.calories,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
    }));
  };

  const handleSave = async () => {
    setFormError(null);
    try {
      const parsed = await nutritionLogSchema.validate(form, {
        abortEarly: false,
      });
      await onSubmit(parsed);
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Check your entries";
      setFormError(msg);
    }
  };

  return (
    <View className="absolute inset-0 z-100 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[88%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader
          title={
            tab === "rider" ? "Log rider nutrition" : "Log horse nutrition"
          }
          onClose={onClose}
        />
        <KeyboardAwareScrollView
          className="px-5 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Typography.SubHeading2 className="text-primaryText mb-2">
            Quick add
          </Typography.SubHeading2>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {QUICK_ADD_TEMPLATES.map((t) => (
              <Pressable
                key={t.label}
                onPress={() => applyTemplate(t)}
                className="bg-primary/10 border border-primary/25 px-3 py-2 rounded-full active:opacity-80"
              >
                <Typography.Caption1 className="text-primary font-poppins-semibold">
                  {t.label}
                </Typography.Caption1>
              </Pressable>
            ))}
          </ScrollView>

          <View className="gap-y-3 mb-4">
            <Typography.SubHeading2 className="text-primaryText">
              Calories
            </Typography.SubHeading2>
            <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
              <TextInput
                placeholder="Calories (e.g. 450)"
                value={form.calories}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, calories: text }))
                }
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                className={`text-base text-primaryText ${form.calories ? "font-poppins-medium" : ""}`}
              />
            </View>
          </View>

          <View className="gap-y-3 mb-4">
            <Typography.SubHeading2 className="text-primaryText">
              {tab === "rider" ? "Food name" : "Item name"}
            </Typography.SubHeading2>
            <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
              <TextInput
                placeholder={
                  tab === "rider" ? "e.g. Chicken breast" : "e.g. Grain + hay"
                }
                value={form.item_name}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, item_name: text }))
                }
                placeholderTextColor="#9ca3af"
                className={`text-base text-primaryText ${form.item_name ? "font-poppins-medium" : ""}`}
              />
            </View>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 gap-y-2">
              <Typography.Caption1 className="text-secondaryText">
                Protein (g)
              </Typography.Caption1>
              <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
                <TextInput
                  placeholder="0"
                  value={form.protein}
                  onChangeText={(text) =>
                    setForm((f) => ({ ...f, protein: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                  className={`text-base text-primaryText ${form.protein ? "font-poppins-medium" : ""}`}
                />
              </View>
            </View>
            <View className="flex-1 gap-y-2">
              <Typography.Caption1 className="text-secondaryText">
                Carbs (g)
              </Typography.Caption1>
              <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
                <TextInput
                  placeholder="0"
                  value={form.carbs}
                  onChangeText={(text) =>
                    setForm((f) => ({ ...f, carbs: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                  className={`text-base text-primaryText ${form.carbs ? "font-poppins-medium" : ""}`}
                />
              </View>
            </View>
          </View>

          <View className="gap-y-3 mb-6">
            <Typography.Caption1 className="text-secondaryText">
              Fat (g)
            </Typography.Caption1>
            <View className="bg-background-secondary rounded-full px-4 h-14 justify-center border border-border">
              <TextInput
                placeholder="0"
                value={form.fat}
                onChangeText={(text) => setForm((f) => ({ ...f, fat: text }))}
                keyboardType="decimal-pad"
                placeholderTextColor="#9ca3af"
                className={`text-base text-primaryText ${form.fat ? "font-poppins-medium" : ""}`}
              />
            </View>
          </View>

          {formError ? (
            <Typography.Body2 className="text-danger mb-3">
              {formError}
            </Typography.Body2>
          ) : null}

          <Button
            title="Add log"
            onPress={() => void handleSave()}
            loading={submitting}
          />
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

/** Shared nutrition tracker UI (settings + profile stack). */
export function NutritionTrackerPanel() {
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const successColor = useCSSVariable("--color-success") as string;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<T_NUTRITION_TAB>("rider");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { logs, loading, loadLogs, insertLog } = useNutritionLogs(
    profile?.id,
    selectedDate,
    tab,
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totals = useMemo(() => {
    return {
      calories: logs.reduce((s, log) => s + (log.calories || 0), 0),
      protein: logs.reduce((s, log) => s + (log.protein_grams || 0), 0),
      carbs: logs.reduce((s, log) => s + (log.carbs_grams || 0), 0),
      fat: logs.reduce((s, log) => s + (log.fat_grams || 0), 0),
    };
  }, [logs]);

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

  const onSubmitLog = async (values: T_NUTRITION_LOG_FORM) => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      const calories = values.calories.trim()
        ? parseInt(values.calories, 10)
        : 0;
      const protein = values.protein.trim() ? parseFloat(values.protein) : 0;
      const carbs = values.carbs.trim() ? parseFloat(values.carbs) : 0;
      const fat = values.fat.trim() ? parseFloat(values.fat) : 0;

      await insertLog({
        item_name: values.item_name.trim(),
        meal_type: values.meal_type || "meal",
        calories: Number.isFinite(calories) ? calories : 0,
        protein_grams: Number.isFinite(protein) ? protein : 0,
        carbs_grams: Number.isFinite(carbs) ? carbs : 0,
        fat_grams: Number.isFinite(fat) ? fat : 0,
      });
      void trackInteraction("nutrition", "log_added", { tab });
      Alert.alert("Success", "Log added successfully");
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to add log",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = useCallback(async () => {
    void trackInteraction("nutrition", "pull_refresh", {});
    setRefreshing(true);
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  if (loading && logs.length === 0) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading nutrition…
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
          onChange={(v) => setTab(v as T_NUTRITION_TAB)}
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

      <View className="flex-row gap-2 px-3 py-3 bg-background border-b border-border">
        <StatMetricCard
          icon="flame"
          iconColor={primaryColor}
          value={String(totals.calories)}
          label="Calories"
        />
        <StatMetricCard
          icon="nutrition"
          iconColor={successColor}
          value={totals.protein.toFixed(1)}
          label="Protein"
        />
        <StatMetricCard
          icon="leaf"
          iconColor={successColor}
          value={totals.carbs.toFixed(1)}
          label="Carbs"
        />
        <StatMetricCard
          icon="water"
          iconColor={primaryColor}
          value={totals.fat.toFixed(1)}
          label="Fat"
        />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {logs.length === 0 ? (
          <View className="items-center py-16 px-4">
            <Ionicons name="restaurant-outline" size={64} color="#d1d5db" />
            <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
              No nutrition logs for this day
            </Typography.SubHeading1>
            <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
              Tap the + button to add an entry. Quick add chips in the sheet
              speed things up.
            </Typography.Body2>
          </View>
        ) : (
          logs.map((log) => (
            <View
              key={log.id}
              className="bg-card border border-border rounded-2xl p-4 mb-3"
            >
              <View className="flex-row justify-between items-center mb-3">
                <Typography.Body2 className="text-primaryText font-poppins-semibold flex-1">
                  {logLabel(log)}
                </Typography.Body2>
                <View className="bg-primary/10 px-2 py-1 rounded-lg">
                  <Typography.Caption1 className="text-primary capitalize">
                    {log.meal_type}
                  </Typography.Caption1>
                </View>
              </View>
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Typography.Heading3 className="text-primaryText tabular-nums">
                    {log.calories}
                  </Typography.Heading3>
                  <Typography.Caption1 className="text-secondaryText">
                    cal
                  </Typography.Caption1>
                </View>
                <View className="items-center flex-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold tabular-nums">
                    {log.protein_grams}g
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    protein
                  </Typography.Caption1>
                </View>
                <View className="items-center flex-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold tabular-nums">
                    {log.carbs_grams}g
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    carbs
                  </Typography.Caption1>
                </View>
                <View className="items-center flex-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold tabular-nums">
                    {log.fat_grams}g
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    fat
                  </Typography.Caption1>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <FloatingRoundedIconButton
        icon={<Ionicons name="add" size={28} color="#fff" />}
        onPress={() => setSheetOpen(true)}
        accessibilityLabel="Add nutrition log"
      />

      <NutritionAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tab={tab}
        onSubmit={onSubmitLog}
        submitting={submitting}
      />
    </View>
  );
}

const SettingsNutritionScreen = () => {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to log rider and horse nutrition by day.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <NutritionTrackerPanel />
    </View>
  );
};

export default SettingsNutritionScreen;
