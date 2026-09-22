import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Dropdown,
  GooglePlacesInput,
  Input,
  ScreenWrapper,
  TopTabs,
} from "@/components";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";
import { useAuth } from "@/provider/AuthProvider";
import { assertSupabaseConfigured } from "@/lib/supabase";
import { useAddEvent } from "@/services/supabase/useAddEvent";
import { T_ADD_EVENT_FORM, T_ADD_EVENT_SCHEMA, T_EVENT_TYPE } from "./types";
import DatePicker from "@/components/ui/DatePicker";
import { T_GOOGLE_PLACE_META } from "@/components/ui/GooglePlacesInput/types";
import { useTrackScreenFocus } from "@/analytics";

const AddEventScreen = () => {
  useTrackScreenFocus("add_event");
  const { profile } = useAuth();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const placeholderTextColor = useCSSVariable("--color-placeholderText") as string;

  const { addEvent, loading } = useAddEvent();
  const [selectedPlaceMeta, setSelectedPlaceMeta] =
    useState<T_GOOGLE_PLACE_META | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<T_ADD_EVENT_FORM>({
    mode: "onSubmit",
    resolver: yupResolver(T_ADD_EVENT_SCHEMA),
    defaultValues: {
      eventName: "",
      eventType: "jackpot",
      organization: "",
      description: "",
      location: "",
      startDate: "",
      endDate: "",
      registrationDeadline: "",
      entryFee: "",
      prizePool: "",
      maxEntries: "",
      divisionsOffered: [],
      rules: "",
    },
  });

  const eventType = watch("eventType");

  const eventTypeTabs = useMemo(
    () => [
      { label: "Jackpot", value: "jackpot" },
      { label: "Rodeo", value: "rodeo" },
      { label: "Clinic", value: "clinic" },
      { label: "Practice", value: "practice" },
    ],
    [],
  );

  const divisionOptions = useMemo(
    () =>
      ["1D", "2D", "3D", "4D", "5D", "Open", "Youth", "Senior"].map(
        (division) => ({
          label: division,
          value: division,
        }),
      ),
    [],
  );

  const onSubmit: SubmitHandler<T_ADD_EVENT_FORM> = async (formData) => {
    if (!profile?.id) {
      showAlert("You must be logged in to create an event.", "error");
      return;
    }

    try {
      setSubmitting(true);
      assertSupabaseConfigured();

      const entryFee = formData.entryFee ? Number(formData.entryFee) : 0;
      const prizePool = formData.prizePool ? Number(formData.prizePool) : 0;
      const maxEntries = formData.maxEntries ? Number(formData.maxEntries) : null;

      const payload = {
        event_name: formData.eventName.trim(),
        event_type: formData.eventType,
        organization: formData.organization.trim() || null,
        description: formData.description.trim() || null,
        start_date: new Date(formData.startDate).toISOString(),
        end_date: new Date(formData.endDate).toISOString(),
        location_name: formData.location.trim(),
        address:
          selectedPlaceMeta?.address?.trim() || formData.location.trim() || null,
        latitude: selectedPlaceMeta?.latitude ?? null,
        longitude: selectedPlaceMeta?.longitude ?? null,
        entry_fee: entryFee,
        max_entries: maxEntries,
        prize_pool_cents: Math.round(prizePool * 100),
        status: "published" as const,
        country: (profile as any)?.country || "USA",
        currency: (profile as any)?.preferred_currency || "USD",
        payout_structure: {
          divisions: formData.divisionsOffered,
          rules: formData.rules.trim() || null,
          registration_deadline: new Date(
            formData.registrationDeadline,
          ).toISOString(),
        },
      };

      await addEvent(payload);

      showAlert("Event created successfully!", "success");
      router.back();
    } catch (error: any) {
      showAlert(
        typeof error?.message === "string"
          ? error.message
          : "Failed to create event",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
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
          Add Event
        </Typography.SubHeading1>
        <View className="w-20">
          <Button
            title="Save"
            onPress={handleSubmit(onSubmit)}
            loading={loading || submitting}
          />
        </View>
      </View>

      <ScreenWrapper withoutTPadding withoutBPadding>
        <KeyboardAwareScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="always"
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="px-5 py-6 pb-10 gap-y-4"
        >
          <Controller
            control={control}
            name="eventName"
            render={({ field: { value, onChange } }) => (
              <Input
                label="Event Name"
                placeholder="Summer Jackpot Series"
                icon={<Feather name="calendar" size={20} color={primaryTextColor} />}
                value={value}
                onChangeText={onChange}
                errorText={errors.eventName?.message}
              />
            )}
          />

          <View className="gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Event Type
            </Typography.SubHeading2>
            <TopTabs
              options={eventTypeTabs}
              selected={eventType}
              onChange={(value) => setValue("eventType", value as T_EVENT_TYPE)}
            />
          </View>

          <Controller
            control={control}
            name="organization"
            render={({ field: { value, onChange } }) => (
              <Input
                label="Organization (Optional)"
                placeholder="NBHA, WPRA, etc."
                icon={<Feather name="users" size={20} color={primaryTextColor} />}
                value={value}
                onChangeText={onChange}
                errorText={errors.organization?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View className="gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  Description
                </Typography.SubHeading2>
                <View className="bg-background-secondary rounded-3xl px-4 py-2 min-h-28">
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Event details and information..."
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                    className={`text-primaryText text-base min-h-20 ${value ? "font-oxygen-regular" : ""}`}
                  />
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="location"
            render={({ field: { value, onChange } }) => (
              <GooglePlacesInput
                label="Location"
                placeholder="Search location"
                value={value}
                onChangeValue={onChange}
                onSelectPlace={setSelectedPlaceMeta}
                errorText={errors.location?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="startDate"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                label="Start Date"
                placeholder="Select start date"
                value={value}
                onChangeValue={onChange}
                errorText={errors.startDate?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="endDate"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                label="End Date"
                placeholder="Select end date"
                value={value}
                onChangeValue={onChange}
                errorText={errors.endDate?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="registrationDeadline"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                label="Registration Deadline"
                placeholder="Select deadline"
                value={value}
                onChangeValue={onChange}
                errorText={errors.registrationDeadline?.message}
              />
            )}
          />

          <View className="flex-row gap-x-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="entryFee"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Entry Fee"
                    placeholder="0.00"
                    icon={<Feather name="dollar-sign" size={20} color={primaryTextColor} />}
                    value={value}
                    onChangeText={onChange}
                    errorText={errors.entryFee?.message}
                    inputProps={{ keyboardType: "decimal-pad" }}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="prizePool"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Prize Pool"
                    placeholder="0.00"
                    icon={<Feather name="award" size={20} color={primaryTextColor} />}
                    value={value}
                    onChangeText={onChange}
                    errorText={errors.prizePool?.message}
                    inputProps={{ keyboardType: "decimal-pad" }}
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="maxEntries"
            render={({ field: { value, onChange } }) => (
              <Input
                label="Max Entries (Optional)"
                placeholder="Leave blank for unlimited"
                icon={<Feather name="hash" size={20} color={primaryTextColor} />}
                value={value}
                onChangeText={onChange}
                errorText={errors.maxEntries?.message}
                inputProps={{ keyboardType: "number-pad" }}
              />
            )}
          />

          <Controller
            control={control}
            name="divisionsOffered"
            render={({ field: { value, onChange } }) => (
              <Dropdown
                icon={<Feather name="layers" size={20} color={primaryTextColor} />}
                label="Divisions Offered"
                placeholder="Select one or more divisions"
                value={value}
                onChangeValue={(next) => onChange(next as string[])}
                options={divisionOptions}
                multiSelect
                errorText={errors.divisionsOffered?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="rules"
            render={({ field: { value, onChange } }) => (
              <View className="gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  Rules & Information
                </Typography.SubHeading2>
                <View className="bg-background-secondary rounded-3xl px-4 py-2 min-h-28">
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Event rules and additional information..."
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                    className={`text-primaryText text-base min-h-20 ${value ? "font-oxygen-regular" : ""}`}
                  />
                </View>
              </View>
            )}
          />
        </KeyboardAwareScrollView>
      </ScreenWrapper>
    </View>
  );
};

export default AddEventScreen;

