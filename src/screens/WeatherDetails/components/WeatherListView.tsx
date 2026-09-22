import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppRefreshControl, IconTabs } from "@/components";
import { Typography } from "@/utils/typography";
import { getWeatherIconName, getWindDirection } from "@/utils/weatherApi";
import type { AppUnits } from "@/utils/userSettings";
import { temperatureUnitLabel, windUnitLabel } from "@/utils/userSettings";
import {
  alertSeverityClasses,
  formatCondition,
  type DailyForecast,
} from "../utils";
import type { HorseCareAlert } from "../types";

type T_PROPS = {
  refreshing: boolean;
  onRefresh: () => void;
  locationName: string;
  appUnits: AppUnits;
  onUnitsChange: (u: AppUnits) => void;
  currentWeather: any | null;
  secondaryText: string;
  primaryColor: string;
  horseCareEnabled: boolean;
  horseCareAlerts: HorseCareAlert[];
  forecastDays: DailyForecast[];
};

const WeatherListView: React.FC<T_PROPS> = ({
  refreshing,
  onRefresh,
  locationName,
  appUnits,
  onUnitsChange,
  currentWeather,
  secondaryText,
  primaryColor,
  horseCareEnabled,
  horseCareAlerts,
  forecastDays,
}) => {
  const tempUnit = temperatureUnitLabel(appUnits);
  const windLabel = windUnitLabel(appUnits);

  const unitTabOptions = useMemo(
    () => [
      {
        value: "imperial",
        renderIcon: (isActive: boolean) => (
          <Typography.Body2
            className={
              isActive ? "text-white font-oxygen-bold" : "text-secondaryText"
            }
          >
            °F
          </Typography.Body2>
        ),
      },
      {
        value: "metric",
        renderIcon: (isActive: boolean) => (
          <Typography.Body2
            className={
              isActive ? "text-white font-oxygen-bold" : "text-secondaryText"
            }
          >
            °C
          </Typography.Body2>
        ),
      },
    ],
    [],
  );

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="px-5 pt-6 pb-12 gap-y-4"
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {!!locationName && (
        <Typography.Heading3 className="text-primaryText mb-1">
          {locationName}
        </Typography.Heading3>
      )}

      <IconTabs
        options={unitTabOptions}
        selected={appUnits}
        onChange={(value) => void onUnitsChange(value as AppUnits)}
      />

      {!currentWeather ? (
        <View className="bg-background-secondary rounded-2xl border border-border p-6 items-center gap-y-2">
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={secondaryText}
          />
          <Typography.Body2 className="text-secondaryText text-center">
            Weather data is unavailable. Pull down to try again.
          </Typography.Body2>
        </View>
      ) : (
        <>
          <View className="bg-background-secondary rounded-2xl border border-border p-4 gap-y-4">
            <Typography.SubHeading2 className="text-primaryText">
              Current conditions
            </Typography.SubHeading2>

            <View className="flex-row items-center gap-x-4">
              <Ionicons
                name={getWeatherIconName(currentWeather.weather?.[0]?.icon) as any}
                size={72}
                color={primaryColor}
              />
              <View className="flex-1 gap-y-1">
                <Typography.Heading3 className="text-primaryText">
                  {Math.round(currentWeather.main?.temp ?? 0)}
                  {tempUnit}
                </Typography.Heading3>
                <Typography.Body2 className="text-secondaryText">
                  {formatCondition(currentWeather.weather?.[0]?.description)}
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Feels like {Math.round(currentWeather.main?.feels_like ?? 0)}
                  {tempUnit}
                </Typography.Caption1>
              </View>
            </View>

            <View className="flex-row gap-x-3">
              <View className="flex-1 bg-background rounded-xl p-3 items-center gap-y-1 border border-border">
                <Ionicons name="water-outline" size={22} color={primaryColor} />
                <Typography.Caption1 className="text-secondaryText">
                  Humidity
                </Typography.Caption1>
                <Typography.SubHeading2 className="text-primaryText">
                  {currentWeather.main?.humidity ?? 0}%
                </Typography.SubHeading2>
              </View>
              <View className="flex-1 bg-background rounded-xl p-3 items-center gap-y-1 border border-border">
                <Ionicons name="flag-outline" size={22} color={primaryColor} />
                <Typography.Caption1 className="text-secondaryText">
                  Wind
                </Typography.Caption1>
                <Typography.SubHeading2 className="text-primaryText text-center">
                  {Math.round(currentWeather.wind?.speed ?? 0)} {windLabel}{" "}
                  {getWindDirection(currentWeather.wind?.deg ?? 0)}
                </Typography.SubHeading2>
              </View>
            </View>
          </View>

          {horseCareEnabled && (
            <View className="bg-background-secondary rounded-2xl border border-border p-4 gap-y-3">
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="alert-circle-outline" size={22} color="#f59e0b" />
                <Typography.SubHeading2 className="text-primaryText">
                  Horse care alerts
                </Typography.SubHeading2>
              </View>

              {horseCareAlerts.length === 0 ? (
                <Typography.Body2 className="text-secondaryText italic">
                  No temperature-based alerts right now.
                </Typography.Body2>
              ) : (
                horseCareAlerts.map((alert, index) => {
                  const sev = alertSeverityClasses(alert.severity);
                  return (
                    <View
                      key={`${alert.type}-${index}`}
                      className={`rounded-xl border border-border pl-3 py-3 pr-3 border-l-4 ${sev.border} ${sev.bg}`}
                    >
                      <Typography.SubHeading2 className={`mb-2 ${sev.text}`}>
                        {alert.message}
                      </Typography.SubHeading2>
                      <Typography.Caption1 className="text-secondaryText mb-1">
                        Recommendations
                      </Typography.Caption1>
                      {alert.recommendations.map((rec, idx) => (
                        <View
                          key={idx}
                          className="flex-row gap-x-2 items-start mt-1"
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={sev.accent}
                          />
                          <Typography.Body2 className="text-secondaryText flex-1">
                            {rec}
                          </Typography.Body2>
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {forecastDays.length > 0 && (
            <View className="gap-y-2">
              <Typography.SubHeading2 className="text-primaryText">
                7-day outlook
              </Typography.SubHeading2>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-x-3 pb-1"
              >
                {forecastDays.map((day, index) => (
                  <View
                    key={`${day.day}-${index}`}
                    className="bg-background-secondary rounded-2xl border border-border px-4 py-3 items-center min-w-[92] gap-y-1"
                  >
                    <Typography.Caption1 className="text-primaryText font-oxygen-bold">
                      {day.day}
                    </Typography.Caption1>
                    <Ionicons name={day.icon as any} size={28} color={primaryColor} />
                    <Typography.SubHeading2 className="text-primaryText">
                      {day.high}
                      {tempUnit}
                    </Typography.SubHeading2>
                    <Typography.Body2 className="text-secondaryText">
                      {day.low}
                      {tempUnit}
                    </Typography.Body2>
                    {day.precipitation > 0 && (
                      <View className="flex-row items-center gap-x-1 mt-1">
                        <Ionicons name="water" size={12} color={primaryColor} />
                        <Typography.Caption1 className="text-primary">
                          {day.precipitation}%
                        </Typography.Caption1>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default WeatherListView;
