import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
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
  Input,
  SheetFormHeader,
  TopTabs,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  useTrainerDirectory,
  type T_TRAINER_SORT,
  type T_REGISTER_TRAINER,
} from "@/services/supabase/useTrainerDirectory";
import type { T_TRAINER_LIST_ROW } from "@/services/supabase/trainerTypes";
import { trackInteraction, useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function matchesSearch(t: T_TRAINER_LIST_ROW, q: string) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [
    t.business_name,
    t.profiles?.name,
    t.location_city,
    t.location_state,
    ...(t.specialties || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(s);
}

const emptyRegister = (): T_REGISTER_TRAINER => ({
  business_name: "",
  bio: "",
  training_philosophy: "",
  specialties: [],
  years_experience: 0,
  location_city: "",
  location_state: "",
  hourly_rate: null,
  accepts_beginners: true,
});

export default function TrainersContent() {
  useTrackScreenFocus("trainer_directory");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { profile } = useAuth();
  const userId = profile?.id;

  const {
    trainers,
    loading,
    sortBy,
    setSortBy,
    refresh,
    isTrainer,
    registerTrainer,
  } = useTrainerDirectory(userId);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reg, setReg] = useState<T_REGISTER_TRAINER>(emptyRegister);
  const [specialtyText, setSpecialtyText] = useState("");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const filtered = useMemo(
    () => trainers.filter((t) => matchesSearch(t, searchQuery)),
    [trainers, searchQuery],
  );

  const submitRegister = useCallback(async () => {
    if (!reg.business_name.trim() || !reg.bio.trim()) {
      Alert.alert("Missing", "Business name and bio are required.");
      return;
    }
    const specs = specialtyText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await registerTrainer({
        ...reg,
        specialties: specs.length ? specs : ["General"],
        years_experience: Number(reg.years_experience) || 0,
        hourly_rate: reg.hourly_rate != null ? Number(reg.hourly_rate) : null,
      });
      void trackInteraction("trainer_directory", "register_trainer", {});
      setRegisterOpen(false);
      setReg(emptyRegister());
      setSpecialtyText("");
      Alert.alert("Success", "Your trainer profile was created.");
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not register",
      );
    } finally {
      setSaving(false);
    }
  }, [reg, specialtyText, registerTrainer]);

  if (loading && trainers.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading trainers…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-y-4">
          <View className="gap-y-4">
            <Input
              placeholder="Search name, city, specialty…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              icon={
                <Ionicons name="search-outline" size={20} color="#9ca3af" />
              }
            />
            <TopTabs
              options={[
                { label: "Rating", value: "rating" },
                { label: "Price low", value: "price_low" },
                { label: "Price high", value: "price_high" },
              ]}
              selected={sortBy}
              onChange={(v) => setSortBy(v as T_TRAINER_SORT)}
            />
          </View>
          {!isTrainer ? (
            <Button
              title="Register as a trainer"
              onPress={() => {
                void trackInteraction("trainer_directory", "register_open", {});
                setRegisterOpen(true);
              }}
            />
          ) : null}

          <Typography.Body2 className="text-secondaryText">
            Find coaches and trainers. Tap a card to see experience and
            services.
          </Typography.Body2>

          {filtered.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="school-outline" size={56} color="#d1d5db" />
              <Typography.Body2 className="text-secondaryText mt-3 text-center">
                No trainers match your search.
              </Typography.Body2>
            </View>
          ) : (
            filtered.map((t) => (
              <View
                key={t.id}
                className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-3"
              >
                <View className="flex-row gap-x-3">
                  {t.profiles?.avatar_url ? (
                    <Image
                      source={{ uri: t.profiles.avatar_url }}
                      className="w-14 h-14 rounded-full bg-background"
                    />
                  ) : (
                    <View className="w-14 h-14 rounded-full bg-primary/15 items-center justify-center">
                      <Ionicons name="person" size={28} color={primaryColor} />
                    </View>
                  )}
                  <View className="flex-1 min-w-0 gap-y-1">
                    <Typography.Body2 className="text-primaryText font-poppins-bold text-lg">
                      {t.business_name}
                    </Typography.Body2>
                    {t.profiles?.name ? (
                      <Typography.Caption1 className="text-secondaryText">
                        {t.profiles.name}
                      </Typography.Caption1>
                    ) : null}
                    <View className="flex-row items-center gap-x-2 flex-wrap">
                      <View className="flex-row items-center gap-x-1">
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Typography.Caption1 className="text-primaryText font-poppins-semibold">
                          {t.rating?.toFixed?.(1) ?? "—"} (
                          {t.total_reviews ?? 0})
                        </Typography.Caption1>
                      </View>
                      {t.hourly_rate != null ? (
                        <Typography.Caption1 className="text-secondaryText">
                          ${t.hourly_rate}/hr
                        </Typography.Caption1>
                      ) : null}
                    </View>
                  </View>
                </View>
                {t.location_city || t.location_state ? (
                  <View className="flex-row items-center gap-x-2">
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color="#6b7280"
                    />
                    <Typography.Body2 className="text-secondaryText">
                      {[t.location_city, t.location_state]
                        .filter(Boolean)
                        .join(", ")}
                    </Typography.Body2>
                  </View>
                ) : null}
                {t.specialties?.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {t.specialties.slice(0, 5).map((sp) => (
                      <View
                        key={sp}
                        className="bg-primary/10 px-2 py-1 rounded-full"
                      >
                        <Typography.Caption1 className="text-primary">
                          {sp}
                        </Typography.Caption1>
                      </View>
                    ))}
                  </View>
                ) : null}
                {t.bio ? (
                  <Text
                    className="text-secondaryText font-poppins text-base"
                    numberOfLines={4}
                  >
                    {t.bio}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={registerOpen}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        onRequestClose={() => setRegisterOpen(false)}
      >
        <View className="flex-1 bg-background">
          <SheetFormHeader
            title="Trainer registration"
            onClose={() => setRegisterOpen(false)}
          />
          <KeyboardAwareScrollView
            className="px-5 py-6"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View className="gap-y-6">
              <Input
                label="Business name *"
                value={reg.business_name}
                onChangeText={(text) =>
                  setReg((r) => ({ ...r, business_name: text }))
                }
              />
              <Input
                label="Bio *"
                placeholder="Tell riders about your program"
                value={reg.bio}
                onChangeText={(text) => setReg((r) => ({ ...r, bio: text }))}
              />
              <Input
                label="Training philosophy"
                value={reg.training_philosophy}
                onChangeText={(text) =>
                  setReg((r) => ({ ...r, training_philosophy: text }))
                }
              />
              <Input
                label="Specialties (comma separated)"
                placeholder="Breakaway racing, youth, …"
                value={specialtyText}
                onChangeText={setSpecialtyText}
              />
              <Input
                label="Years experience"
                value={String(reg.years_experience)}
                onChangeText={(text) =>
                  setReg((r) => ({
                    ...r,
                    years_experience: parseInt(text, 10) || 0,
                  }))
                }
                inputProps={{ keyboardType: "number-pad" }}
              />
              <View className="flex-row gap-x-3">
                <View className="flex-1">
                  <Input
                    label="City"
                    value={reg.location_city}
                    onChangeText={(text) =>
                      setReg((r) => ({ ...r, location_city: text }))
                    }
                  />
                </View>
                <View className="w-24">
                  <Input
                    label="State"
                    value={reg.location_state}
                    onChangeText={(text) =>
                      setReg((r) => ({ ...r, location_state: text }))
                    }
                    inputProps={{ autoCapitalize: "characters" }}
                  />
                </View>
              </View>
              <Input
                label="Hourly rate (USD)"
                value={reg.hourly_rate != null ? String(reg.hourly_rate) : ""}
                onChangeText={(text) =>
                  setReg((r) => ({
                    ...r,
                    hourly_rate: text.trim() ? parseFloat(text) : null,
                  }))
                }
                inputProps={{ keyboardType: "decimal-pad" }}
              />
              <Pressable
                onPress={() =>
                  setReg((r) => ({
                    ...r,
                    accepts_beginners: !r.accepts_beginners,
                  }))
                }
                className="flex-row items-center gap-x-3"
              >
                <Ionicons
                  name={reg.accepts_beginners ? "checkbox" : "square-outline"}
                  size={24}
                  color={primaryColor}
                />
                <Typography.Body2 className="text-primaryText">
                  Accepts beginners
                </Typography.Body2>
              </Pressable>
              <Button
                title="Submit profile"
                loading={saving}
                onPress={() => void submitRegister()}
              />
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}
