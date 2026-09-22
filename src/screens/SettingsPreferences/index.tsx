import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useTrackScreenFocus, trackInteraction } from "@/analytics";
import {
  AppUnits,
  fetchUserUnits,
  upsertUserUnits,
} from "@/utils/userSettings";
import {
  DEFAULT_WEATHER_PREFERENCES,
  type WeatherPreferences,
} from "./types";

function mergeWeatherPreferences(
  raw: Record<string, unknown> | null | undefined,
): WeatherPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_WEATHER_PREFERENCES };
  }
  return {
    ...DEFAULT_WEATHER_PREFERENCES,
    temperature_unit:
      typeof raw.temperature_unit === "string"
        ? raw.temperature_unit
        : DEFAULT_WEATHER_PREFERENCES.temperature_unit,
    weather_alerts_enabled:
      typeof raw.weather_alerts_enabled === "boolean"
        ? raw.weather_alerts_enabled
        : DEFAULT_WEATHER_PREFERENCES.weather_alerts_enabled,
    severe_weather_alerts:
      typeof raw.severe_weather_alerts === "boolean"
        ? raw.severe_weather_alerts
        : DEFAULT_WEATHER_PREFERENCES.severe_weather_alerts,
    horse_care_alerts:
      typeof raw.horse_care_alerts === "boolean"
        ? raw.horse_care_alerts
        : DEFAULT_WEATHER_PREFERENCES.horse_care_alerts,
  };
}

const SettingsPreferencesScreen = () => {
  useTrackScreenFocus("app_settings_preferences");
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const secondaryText = useCSSVariable("--color-secondaryText") as string;

  const [loading, setLoading] = useState(true);
  const [savingUnits, setSavingUnits] = useState(false);
  const [savingWeather, setSavingWeather] = useState(false);
  const [units, setUnits] = useState<AppUnits>("imperial");
  const [weatherPrefs, setWeatherPrefs] = useState<WeatherPreferences>({
    ...DEFAULT_WEATHER_PREFERENCES,
  });

  const load = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [u, { data, error }] = await Promise.all([
        fetchUserUnits(userId),
        supabase
          .from("profiles")
          .select("weather_preferences")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (error) throw error;
      setUnits(u);
      setWeatherPrefs(
        mergeWeatherPreferences(
          data?.weather_preferences as Record<string, unknown> | undefined,
        ),
      );
    } catch (e) {
      console.error("SettingsPreferences load:", e);
      showAlert("Could not load your preferences.", "error");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleUnitsChange = useCallback(
    async (next: AppUnits) => {
      const userId = profile?.id;
      if (!userId) return;
      const prev = units;
      setUnits(next);
      setSavingUnits(true);
      const ok = await upsertUserUnits(userId, next);
      setSavingUnits(false);
      if (!ok) {
        setUnits(prev);
        showAlert("Failed to update units.", "error");
        return;
      }
      void trackInteraction("settings", "units_changed", { units: next });
    },
    [profile?.id, units],
  );

  const persistWeatherPreferences = useCallback(
    async (next: WeatherPreferences) => {
      const userId = profile?.id;
      if (!userId) return;
      setSavingWeather(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ weather_preferences: next })
          .eq("id", userId);
        if (error) throw error;
        setWeatherPrefs(next);
        void trackInteraction("settings", "weather_preferences_updated", {});
      } catch (e) {
        console.error("persistWeatherPreferences:", e);
        showAlert("Failed to update weather preferences.", "error");
        await load();
      } finally {
        setSavingWeather(false);
      }
    },
    [load, profile?.id],
  );

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to manage app settings and preferences.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const trackFalse = "#D1D5DB";
  const trackTrue = "#93C5FD";

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 py-6 gap-y-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Typography.Body2 className="text-secondaryText">
          Units, weather alerts, and account shortcuts. These match the options
          from the classic weather settings screen.
        </Typography.Body2>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Account
          </Typography.SubHeading2>
          <Pressable
            onPress={() => router.push("/edit-profile")}
            className="bg-background-secondary border border-border rounded-2xl p-4 flex-row items-center justify-between gap-x-3 active:opacity-90"
          >
            <View className="flex-row items-center gap-x-3 flex-1">
              <Ionicons name="person-outline" size={22} color={secondaryText} />
              <View className="flex-1 gap-y-1">
                <Typography.Body2 className="text-primaryText font-poppins-medium">
                  Edit profile
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Name, photo, and profile details
                </Typography.Caption1>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={secondaryText} />
          </Pressable>
        </View>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Units
          </Typography.SubHeading2>
          <View className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-3">
            <View className="gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-medium">
                Temperature & wind
              </Typography.Body2>
              <Typography.Caption1 className="text-secondaryText">
                Used for weather and forecasts across the app.
              </Typography.Caption1>
            </View>
            <View className="flex-row gap-x-3">
              <Pressable
                onPress={() => void handleUnitsChange("imperial")}
                disabled={savingUnits}
                className={`flex-1 py-3 rounded-2xl border items-center ${
                  units === "imperial"
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Typography.Body2
                  className={
                    units === "imperial"
                      ? "text-onPrimary font-poppins-semibold"
                      : "text-primaryText"
                  }
                >
                  Imperial (°F)
                </Typography.Body2>
              </Pressable>
              <Pressable
                onPress={() => void handleUnitsChange("metric")}
                disabled={savingUnits}
                className={`flex-1 py-3 rounded-2xl border items-center ${
                  units === "metric"
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Typography.Body2
                  className={
                    units === "metric"
                      ? "text-onPrimary font-poppins-semibold"
                      : "text-primaryText"
                  }
                >
                  Metric (°C)
                </Typography.Body2>
              </Pressable>
            </View>
            {savingUnits ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : null}
          </View>
        </View>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Weather & alerts
          </Typography.SubHeading2>
          <View className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-4">
            <View className="flex-row items-center justify-between gap-x-3">
              <View className="flex-1 gap-y-1">
                <Typography.Body2 className="text-primaryText font-poppins-medium">
                  Weather alerts
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Notifications about meaningful weather changes.
                </Typography.Caption1>
              </View>
              <Switch
                value={weatherPrefs.weather_alerts_enabled}
                disabled={savingWeather}
                onValueChange={(v) =>
                  void persistWeatherPreferences({
                    ...weatherPrefs,
                    weather_alerts_enabled: v,
                  })
                }
                trackColor={{ false: trackFalse, true: trackTrue }}
                thumbColor={
                  weatherPrefs.weather_alerts_enabled ? primaryColor : "#f3f4f6"
                }
              />
            </View>

            <View className="h-px bg-border" />

            <View className="flex-row items-center justify-between gap-x-3">
              <View className="flex-1 gap-y-1">
                <Typography.Body2 className="text-primaryText font-poppins-medium">
                  Severe weather alerts
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Storms and extreme conditions.
                </Typography.Caption1>
              </View>
              <Switch
                value={weatherPrefs.severe_weather_alerts}
                disabled={savingWeather}
                onValueChange={(v) =>
                  void persistWeatherPreferences({
                    ...weatherPrefs,
                    severe_weather_alerts: v,
                  })
                }
                trackColor={{ false: trackFalse, true: trackTrue }}
                thumbColor={
                  weatherPrefs.severe_weather_alerts ? primaryColor : "#f3f4f6"
                }
              />
            </View>

            <View className="h-px bg-border" />

            <View className="flex-row items-center justify-between gap-x-3">
              <View className="flex-1 gap-y-1">
                <Typography.Body2 className="text-primaryText font-poppins-medium">
                  Horse care alerts
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Temperature-based tips on the Settings weather card.
                </Typography.Caption1>
              </View>
              <Switch
                value={weatherPrefs.horse_care_alerts}
                disabled={savingWeather}
                onValueChange={(v) =>
                  void persistWeatherPreferences({
                    ...weatherPrefs,
                    horse_care_alerts: v,
                  })
                }
                trackColor={{ false: trackFalse, true: trackTrue }}
                thumbColor={
                  weatherPrefs.horse_care_alerts ? primaryColor : "#f3f4f6"
                }
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/weather-details")}
          className="bg-background-secondary border border-border rounded-2xl p-4 flex-row items-center justify-between gap-x-3 active:opacity-90"
        >
          <View className="flex-row items-center gap-x-3 flex-1">
            <Ionicons name="partly-sunny-outline" size={22} color={primaryColor} />
            <View className="flex-1 gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-medium">
                Weather details
              </Typography.Body2>
              <Typography.Caption1 className="text-secondaryText">
                Full forecast and conditions
              </Typography.Caption1>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={secondaryText} />
        </Pressable>
      </ScrollView>
    </View>
  );
};

export default SettingsPreferencesScreen;
