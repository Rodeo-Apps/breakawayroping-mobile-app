import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useCSSVariable } from "uniwind";
import {
  fetchCurrentWeather,
  generateHorseCareAlerts,
  getUserLocation,
  getWeatherIconName,
} from "@/utils/weatherApi";
import { AppUnits, fetchUserUnits, windUnitLabel } from "@/utils/userSettings";
import { useTrackScreenFocus } from "@/analytics";
import {
  shouldShowPromoCodeEntry,
  shouldShowSubscriptionPlans,
} from "@/utils/premiumEntitlement";

const SettingsScreen = () => {
  useTrackScreenFocus("settings");
  const { profile, session, signOut, deleteAccount } = useAuth();
  const secondaryText = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;
  const dangerColor = useCSSVariable("--color-danger") as string;
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<any[]>([]);
  const [units, setUnits] = useState<AppUnits>("imperial");
  const [accountDeleting, setAccountDeleting] = useState(false);

  const loadWeather = async () => {
    try {
      setWeatherLoading(true);
      const location = await getUserLocation();
      const preferredUnits = await fetchUserUnits(profile?.id);
      setUnits(preferredUnits);
      const weather = await fetchCurrentWeather(location, preferredUnits);
      setWeatherData(weather);

      const shouldShowHorseCareAlerts = (profile as any)?.weather_preferences
        ?.horse_care_alerts;
      if (weather && shouldShowHorseCareAlerts) {
        const alerts = generateHorseCareAlerts(
          weather.main.temp,
          preferredUnits,
        );
        setWeatherAlerts(alerts);
      } else {
        setWeatherAlerts([]);
      }
    } catch (error) {
      setWeatherData(null);
      setWeatherAlerts([]);
    } finally {
      setWeatherLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadWeather();
    }, [profile?.id]),
  );

  const quickAccess = useMemo(
    () => [
      {
        label: "Go Live",
        icon: "radio-outline",
        iconType: "ionicons" as const,
        route: "/more/go-live",
      },
      {
        label: "Time Run",
        icon: "timer-outline",
        iconType: "ionicons" as const,
        route: "/time-runs",
      },
      {
        label: "Horses",
        icon: "horse",
        iconType: "material" as const,
        route: "/more/horses",
      },
      {
        label: "Hauling",
        icon: "car-outline",
        iconType: "ionicons" as const,
        route: "/more/hauling",
      },
      {
        label: "Entries",
        icon: "list-outline",
        iconType: "ionicons" as const,
        route: "/more/entries",
      },
      {
        label: "Emergency",
        icon: "warning-outline",
        iconType: "ionicons" as const,
        route: "/more/emergency",
      },
      {
        label: "Live Results",
        icon: "trophy",
        iconType: "ionicons" as const,
        route: "/more/live-results",
      },
      {
        label: "Health",
        icon: "heart",
        iconType: "ionicons" as const,
        route: "/more/health",
      },
      {
        label: "Video",
        icon: "videocam",
        iconType: "ionicons" as const,
        route: "/more/video",
      },
      {
        label: "AI Insights",
        icon: "bulb",
        iconType: "ionicons" as const,
        route: "/more/ai-insights",
      },
      {
        label: "Travel",
        icon: "map",
        iconType: "ionicons" as const,
        route: "/more/travel",
      },
      {
        label: "Nutrition",
        icon: "restaurant",
        iconType: "ionicons" as const,
        route: "/more/nutrition",
      },
      {
        label: "Workout",
        icon: "fitness",
        iconType: "ionicons" as const,
        route: "/more/workout",
      },
      {
        label: "Sponsors",
        icon: "business",
        iconType: "ionicons" as const,
        route: "/more/sponsors",
      },
      {
        label: "Find Arena",
        icon: "location",
        iconType: "ionicons" as const,
        route: "/more/find-arena",
      },
      {
        label: "Challenges",
        icon: "flame",
        iconType: "ionicons" as const,
        route: "/more/challenges",
      },
      {
        label: "Leaderboard",
        icon: "trophy",
        iconType: "ionicons" as const,
        route: "/more/leaderboard",
      },
    ],
    [],
  );

  const menuItems = useMemo(() => {
    const items = [];

    if (shouldShowSubscriptionPlans(profile)) {
      items.push({
        label: "Subscription plans",
        icon: "star-outline",
        route: "/subscription-plans",
      });
    }

    if (shouldShowPromoCodeEntry(profile)) {
      items.push({
        label: "Promo code",
        icon: "ticket-outline",
        route: "/promo-code",
      });
    }

    items.push(
      {
        label: "Team AI Video Analysis",
        icon: "people-outline",
        route: "/team-analysis",
      },
      {
        label: "Horse & Rider Baseline",
        icon: "body-outline",
        route: "/baseline",
      },
      {
        label: "Schools & Teams",
        icon: "school-outline",
        route: "/crhsr",
      },
      { label: "My Horses", icon: "fitness-outline", route: "/more/my-horses" },
      {
        label: "Health Dashboard",
        icon: "heart-outline",
        route: "/more/health-dashboard",
      },
      { label: "Trainers", icon: "school-outline", route: "/more/trainers" },
      { label: "Services", icon: "briefcase-outline", route: "/more/services" },
      {
        label: "Marketplace",
        icon: "cart-outline",
        route: "/more/marketplace",
      },
      { label: "Messages", icon: "mail-outline", route: "/more/messages" },
      {
        label: "Emergency & Safety",
        icon: "warning-outline",
        route: "/more/emergency-safety",
      },
      {
        label: "Fan Page Settings",
        icon: "eye-outline",
        route: "/more/fan-page-settings",
      },
      {
        label: "App settings",
        icon: "settings-outline",
        route: "/more/app-settings",
      },
    );

    return items;
  }, [profile]);

  const onPressPlaceholder = (label: string) => {
    Alert.alert("Coming Soon", `${label} will be connected next.`);
  };

  const onPressRoute = (route?: string, label?: string) => {
    if (route) {
      router.push(route as any);
      return;
    }
    onPressPlaceholder(label || "Feature");
  };

  const onPressSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert("Error", "Could not sign out. Please try again.");
          }
        },
      },
    ]);
  };

  const onPressDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and all associated data: horses, runs, posts, comments, messages, saved listings, health and activity records, and uploaded files. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              "Your account will be removed immediately and you will be signed out. This is irreversible.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete my account",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      setAccountDeleting(true);
                      try {
                        await deleteAccount();
                      } catch (e) {
                        Alert.alert(
                          "Could not delete account",
                          e instanceof Error
                            ? e.message
                            : "Something went wrong. Please try again or contact support.",
                        );
                      } finally {
                        setAccountDeleting(false);
                      }
                    })();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 py-6 gap-y-4 pb-10"
      >
        {/* Weather Information */}
        <Pressable
          onPress={() => router.push("/weather-details")}
          className="bg-background-secondary rounded-2xl p-4 gap-y-3 active:opacity-90"
        >
          <View className="flex-row items-center justify-between">
            <Typography.SubHeading2 className="text-primaryText">
              Weather Conditions
            </Typography.SubHeading2>
            <View className="flex-row items-center gap-x-1">
              <Ionicons
                name="chevron-forward"
                size={18}
                color={secondaryText}
              />
              <Ionicons
                name="partly-sunny-outline"
                size={20}
                color={secondaryText}
              />
            </View>
          </View>

          {weatherLoading ? (
            <View className="py-2">
              <ActivityIndicator size="small" />
            </View>
          ) : weatherData ? (
            <>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-x-3">
                  <Ionicons
                    name={
                      getWeatherIconName(weatherData.weather?.[0]?.icon) as any
                    }
                    size={36}
                    color={primaryColor}
                  />
                  <View>
                    <Typography.Heading3 className="text-primaryText">
                      {Math.round(weatherData.main?.temp ?? 0)}°
                    </Typography.Heading3>
                    <Typography.Caption1 className="text-secondaryText">
                      {(weatherData.weather?.[0]?.description ?? "")
                        .split(" ")
                        .map(
                          (w: string) => w.charAt(0).toUpperCase() + w.slice(1),
                        )
                        .join(" ")}
                    </Typography.Caption1>
                  </View>
                </View>

                <View className="items-end">
                  <Typography.Caption1 className="text-secondaryText">
                    Humidity {weatherData.main?.humidity ?? 0}%
                  </Typography.Caption1>
                  <Typography.Caption1 className="text-secondaryText">
                    Wind {Math.round(weatherData.wind?.speed ?? 0)}{" "}
                    {windUnitLabel(units)}
                  </Typography.Caption1>
                </View>
              </View>

              {weatherAlerts.length > 0 && (
                <View className="gap-y-2">
                  {weatherAlerts.slice(0, 2).map((alert, index) => (
                    <View
                      key={`${alert.type}-${index}`}
                      className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                    >
                      <Typography.Caption1 className="text-amber-700">
                        {alert.message}
                      </Typography.Caption1>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Typography.Body2 className="text-secondaryText">
              Weather information is unavailable right now.
            </Typography.Body2>
          )}
        </Pressable>

        {/* Quick Access */}
        <View className="bg-background-secondary rounded-2xl overflow-hidden">
          {quickAccess.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => onPressRoute(item.route, item.label)}
              className="px-4 py-3 flex-row items-center justify-between border-b border-border"
            >
              <View className="flex-row items-center gap-x-3">
                {item.iconType === "material" ? (
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={20}
                    color={secondaryText}
                  />
                ) : (
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={secondaryText}
                  />
                )}
                <Typography.Body2 className="text-primaryText">
                  {item.label}
                </Typography.Body2>
              </View>
              <Feather name="chevron-right" size={18} color={secondaryText} />
            </Pressable>
          ))}
        </View>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            More Options
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-2xl overflow-hidden">
            {menuItems.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => onPressRoute(item.route, item.label)}
                className="px-4 py-3 flex-row items-center justify-between border-b border-border"
              >
                <View className="flex-row items-center gap-x-3">
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={secondaryText}
                  />
                  <Typography.Body2 className="text-primaryText">
                    {item.label}
                  </Typography.Body2>
                </View>
                <Feather name="chevron-right" size={18} color={secondaryText} />
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() =>
            onPressRoute("/more/fan-page-privacy", "Fan Page Privacy")
          }
          className="bg-red-50 rounded-2xl border border-red-200 p-4 gap-y-2"
        >
          <View className="flex-row items-center gap-x-2">
            <Ionicons name="shield-checkmark" size={22} color="#DC2626" />
            <Typography.SubHeading2 className="text-red-700">
              Fan Page Privacy
            </Typography.SubHeading2>
          </View>
          <Typography.Body2 className="text-red-600">
            Control your public profile visibility.
          </Typography.Body2>
        </Pressable>

        <View className="gap-y-3">
          <Pressable
            onPress={onPressSignOut}
            disabled={accountDeleting}
            className="bg-danger/10 border border-danger rounded-full h-12 items-center justify-center active:opacity-90"
          >
            <Typography.SubHeading2 className="text-danger">
              Sign Out
            </Typography.SubHeading2>
          </Pressable>

          {session?.user?.id ? (
            <Pressable
              onPress={onPressDeleteAccount}
              disabled={accountDeleting}
              className="rounded-full h-12 items-center justify-center border border-border bg-background-secondary active:opacity-90"
            >
              {accountDeleting ? (
                <ActivityIndicator size="small" color={dangerColor} />
              ) : (
                <Typography.SubHeading2 className="text-danger">
                  Delete account
                </Typography.SubHeading2>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default SettingsScreen;
