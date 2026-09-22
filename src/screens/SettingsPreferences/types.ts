export type WeatherPreferences = {
  temperature_unit: string;
  weather_alerts_enabled: boolean;
  severe_weather_alerts: boolean;
  horse_care_alerts: boolean;
};

export const DEFAULT_WEATHER_PREFERENCES: WeatherPreferences = {
  temperature_unit: "fahrenheit",
  weather_alerts_enabled: true,
  severe_weather_alerts: true,
  horse_care_alerts: true,
};
