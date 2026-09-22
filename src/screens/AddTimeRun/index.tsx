import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, Dropdown, ScreenWrapper, TopTabs } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/utils/toast";
import { T_HORSE_OPTION, T_TIME_RUN_MODE } from "./types";
import ManualTimeRun from "./components/ManualTimeRun";
import AutoTimeRun from "./components/AutoTimeRun";
import { T_TIME_RUN_CHILD_HANDLE } from "./components/types";
import { useTrackScreenFocus } from "@/analytics";

const AddTimeRun = () => {
  useTrackScreenFocus("add_time_run");
  const { profile } = useAuth();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const placeholderTextColor = useCSSVariable(
    "--color-placeholderText",
  ) as string;

  const [horses, setHorses] = useState<T_HORSE_OPTION[]>([]);
  const [horsesLoading, setHorsesLoading] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [mode, setMode] = useState<T_TIME_RUN_MODE>("stopwatch");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const manualRef = useRef<T_TIME_RUN_CHILD_HANDLE>(null);
  const autoRef = useRef<T_TIME_RUN_CHILD_HANDLE>(null);

  const horseOptions = useMemo(
    () => horses.map((horse) => ({ label: horse.name, value: horse.id })),
    [horses],
  );

  const modeOptions = useMemo(
    () => [
      { label: "Stopwatch", value: "stopwatch" },
      { label: "Manual", value: "manual" },
    ],
    [],
  );

  const loadHorses = useCallback(async () => {
    if (!profile?.id) return;
    setHorsesLoading(true);

    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from("horses")
        .select("id, name")
        .eq("owner_id", profile.id)
        .order("name", { ascending: true });

      if (!ownerError) {
        setHorses((ownerData as T_HORSE_OPTION[]) || []);
        return;
      }

      const { data: legacyData, error: legacyError } = await supabase
        .from("horses")
        .select("id, name")
        .eq("user_id", profile.id as any)
        .order("name", { ascending: true });

      if (legacyError) throw legacyError;
      setHorses((legacyData as T_HORSE_OPTION[]) || []);
    } catch (error) {
      setHorses([]);
    } finally {
      setHorsesLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadHorses();
  }, [loadHorses]);

  const onPressSave = () => {
    if (!selectedHorseId) {
      showAlert("Please select a horse first", "warning");
      return;
    }

    if (mode === "manual") {
      manualRef.current?.submit();
      return;
    }

    autoRef.current?.submit();
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 py-4 flex-row items-center justify-between bg-background-secondary border-b border-border">
        <Pressable
          className="bg-background w-10 h-10 rounded-full items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={primaryTextColor} />
        </Pressable>

        <Typography.SubHeading1 className="text-primaryText">
          Add Time Run
        </Typography.SubHeading1>

        <View className="w-20">
          <Button title="Save" onPress={onPressSave} loading={isSubmitting} />
        </View>
      </View>

      <ScreenWrapper withoutTPadding withoutBPadding>
        <KeyboardAwareScrollView
          className="flex-1"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 py-6 gap-y-4 pb-8"
        >
          {horsesLoading ? (
            <View className="h-14 bg-background-secondary rounded-full items-center justify-center">
              <ActivityIndicator size="small" color={primaryTextColor} />
            </View>
          ) : horseOptions.length === 0 ? (
            <View className="bg-background-secondary rounded-2xl p-4 flex-row items-center gap-x-2">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={primaryTextColor}
              />
              <Typography.Body2 className="text-secondaryText flex-1">
                No horses found. Add a horse first before adding a run.
              </Typography.Body2>
            </View>
          ) : (
            <Dropdown
              icon={
                <MaterialCommunityIcons
                  name="horse"
                  size={22}
                  color={primaryTextColor}
                />
              }
              label="Select Horse"
              placeholder="Choose horse"
              value={selectedHorseId}
              onChangeValue={(value) => setSelectedHorseId(value as string)}
              options={horseOptions}
            />
          )}

          <View className="gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Run Mode
            </Typography.SubHeading2>
            <TopTabs
              options={modeOptions}
              selected={mode}
              onChange={(value) => setMode(value as T_TIME_RUN_MODE)}
            />
          </View>

          {mode === "manual" ? (
            <ManualTimeRun
              ref={manualRef}
              horseId={selectedHorseId}
              onSuccess={() => router.back()}
              onSubmittingChange={setIsSubmitting}
              primaryTextColor={primaryTextColor}
              placeholderTextColor={placeholderTextColor}
            />
          ) : (
            <AutoTimeRun
              ref={autoRef}
              horseId={selectedHorseId}
              onSuccess={() => router.back()}
              onSubmittingChange={setIsSubmitting}
              primaryTextColor={primaryTextColor}
              placeholderTextColor={placeholderTextColor}
            />
          )}
        </KeyboardAwareScrollView>
      </ScreenWrapper>
    </View>
  );
};

export default AddTimeRun;
