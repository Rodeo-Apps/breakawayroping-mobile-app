import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useCSSVariable } from "uniwind";
import { supabase } from "@/lib/supabase";
import { Loader, ScreenWrapper } from "@/components";
import { useAuth } from "@/provider/AuthProvider";
import {
  fetchCurrentWeather,
  fetchForecast,
  generateHorseCareAlerts,
  getUserLocation,
} from "@/utils/weatherApi";
import { AppUnits, fetchUserUnits } from "@/utils/userSettings";
import { showAlert } from "@/utils/toast";
import type { HorseCareAlert } from "./types";
import { processForecastData } from "./utils";
import WeatherListView from "./components/WeatherListView";
import { useTrackScreenFocus } from "@/analytics";

const WeatherDetailsScreen = () => {
  useTrackScreenFocus("weather_details");
  const { profile } = useAuth();
  const secondaryText = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [appUnits, setAppUnits] = useState<AppUnits>("imperial");
  const [horseCareAlerts, setHorseCareAlerts] = useState<HorseCareAlert[]>([]);
  const [horseCareEnabled, setHorseCareEnabled] = useState(true);

  const forecastDays = useMemo(() => processForecastData(forecast), [forecast]);

  const loadPreferences = useCallback(async (): Promise<boolean> => {
    if (!profile?.id) {
      setHorseCareEnabled(true);
      return true;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("weather_preferences")
        .eq("id", profile.id)
        .maybeSingle();

      if (error) throw error;
      const prefs = data?.weather_preferences as
        | { horse_care_alerts?: boolean }
        | undefined;
      const enabled = prefs?.horse_care_alerts !== false;
      setHorseCareEnabled(enabled);
      return enabled;
    } catch {
      setHorseCareEnabled(true);
      return true;
    }
  }, [profile?.id]);

  const updateUserUnits = async (units: AppUnits) => {
    if (!profile?.id) return false;
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: profile.id,
        units,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("Error updating units preference:", error);
      showAlert("Could not update units.", "error");
      return false;
    }
    return true;
  };

  const loadWeatherData = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      const isRefresh = opts?.isRefresh ?? false;
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const units = await fetchUserUnits(profile?.id);
        setAppUnits(units);
        const careOn = await loadPreferences();

        const locationCoords = await getUserLocation();

        const [weatherData, forecastData] = await Promise.all([
          fetchCurrentWeather(locationCoords, units),
          fetchForecast(locationCoords, units),
        ]);

        if (!weatherData || !forecastData) {
          setCurrentWeather(null);
          setForecast(null);
          setLocationName("");
          setHorseCareAlerts([]);
          return;
        }

        setCurrentWeather(weatherData);
        setForecast(forecastData);
        setLocationName(weatherData?.name || "");

        if (careOn) {
          const alerts = generateHorseCareAlerts(weatherData.main.temp, units);
          setHorseCareAlerts(alerts);
        } else {
          setHorseCareAlerts([]);
        }
      } catch (e) {
        console.error("Weather load error:", e);
        setCurrentWeather(null);
        setForecast(null);
        setHorseCareAlerts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.id, loadPreferences],
  );

  useFocusEffect(
    useCallback(() => {
      void loadWeatherData();
    }, [loadWeatherData]),
  );

  const handleUnitsChange = async (next: AppUnits) => {
    if (next === appUnits) return;
    const prev = appUnits;
    setAppUnits(next);
    const ok = await updateUserUnits(next);
    if (!ok) {
      setAppUnits(prev);
      return;
    }
    await loadWeatherData();
  };

  const onRefresh = async () => {
    await loadWeatherData({ isRefresh: true });
  };

  if (loading && !currentWeather) {
    return <Loader message="Loading weather..." />;
  }

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <WeatherListView
        refreshing={refreshing}
        onRefresh={onRefresh}
        locationName={locationName}
        appUnits={appUnits}
        onUnitsChange={handleUnitsChange}
        currentWeather={currentWeather}
        secondaryText={secondaryText}
        primaryColor={primaryColor}
        horseCareEnabled={horseCareEnabled}
        horseCareAlerts={horseCareAlerts}
        forecastDays={forecastDays}
      />
    </ScreenWrapper>
  );
};

export default WeatherDetailsScreen;
