import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useFanPageSettings } from "@/services/supabase/useFanPageSettings";
import { trackInteraction, useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FanPageSettingsContent() {
  useTrackScreenFocus("fan_page_settings");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id;

  const { fanPageEnabled, loading, refresh, setEnabled } =
    useFanPageSettings(userId);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) void refresh();
    }, [userId, refresh]),
  );

  const confirmToggle = useCallback(
    async (value: boolean) => {
      setSaving(true);
      try {
        await setEnabled(value);
        void trackInteraction("fan_page", "visibility_toggle", {
          public: value ? 1 : 0,
        });
      } catch {
        Alert.alert("Error", "Failed to update settings.");
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [setEnabled, refresh],
  );

  const onToggle = useCallback(
    (value: boolean) => {
      if (value) {
        Alert.alert(
          "Enable public fan page?",
          "Your profile will be publicly visible, including name, photo, location, competition results, run stats, and achievements. Contact info, messages, and health data stay private.\n\nContinue?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Make public",
              onPress: () => void confirmToggle(true),
            },
          ],
        );
      } else {
        Alert.alert(
          "Disable public fan page?",
          "Only you will see your full profile.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Make private",
              onPress: () => void confirmToggle(false),
            },
          ],
        );
      }
    },
    [confirmToggle],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-y-6">
        <Typography.Body2 className="text-secondaryText">
          Control whether fans can view your public rider profile and stats.
        </Typography.Body2>

        <View className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex-row gap-x-3">
          <Typography.Body2 className="text-lg">⚠️</Typography.Body2>
          <View className="flex-1 gap-y-1">
            <Typography.SubHeading2 className="text-primaryText">
              Privacy
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              Enabling your fan page exposes profile and competition data on the
              internet.
            </Typography.Body2>
          </View>
        </View>

        <View className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-4">
          <View className="flex-row items-center justify-between gap-x-3">
            <Typography.SubHeading2 className="text-primaryText flex-1">
              Public fan page
            </Typography.SubHeading2>
            <View
              className={`px-2 py-1 rounded-lg ${
                fanPageEnabled ? "bg-primary/15" : "bg-background"
              }`}
            >
              <Typography.Caption1
                className={
                  fanPageEnabled ? "text-primary font-poppins-bold" : "text-secondaryText"
                }
              >
                {fanPageEnabled ? "PUBLIC" : "PRIVATE"}
              </Typography.Caption1>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-x-4">
            <View className="flex-1 gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-medium">
                Allow public access
              </Typography.Body2>
              <Typography.Caption1 className="text-secondaryText">
                {fanPageEnabled
                  ? "Visible to everyone with your link or search."
                  : "Only you see your full profile in the app."}
              </Typography.Caption1>
            </View>
            <Switch
              value={fanPageEnabled}
              onValueChange={onToggle}
              disabled={saving}
              trackColor={{ false: "#D1D5DB", true: "#EF4444" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            If public, others may see
          </Typography.SubHeading2>
          {[
            "Name and profile photo",
            "Location (city / region)",
            "Competition results and placements",
            "Run history and statistics",
            "Badges and achievements",
          ].map((line) => (
            <View key={line} className="flex-row items-start gap-x-2">
              <Ionicons name="ellipse" size={6} color={primaryColor} style={{ marginTop: 7 }} />
              <Typography.Body2 className="text-secondaryText flex-1">{line}</Typography.Body2>
            </View>
          ))}
        </View>

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Stays private
          </Typography.SubHeading2>
          {[
            "Email and phone",
            "Messages",
            "Horse health and vet records",
            "Payments and billing",
          ].map((line) => (
            <View key={line} className="flex-row items-start gap-x-2">
              <Ionicons name="lock-closed" size={16} color="#10b981" style={{ marginTop: 3 }} />
              <Typography.Body2 className="text-secondaryText flex-1">{line}</Typography.Body2>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
