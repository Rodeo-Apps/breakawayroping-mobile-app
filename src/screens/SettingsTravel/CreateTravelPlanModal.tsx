import React, { useEffect, useState } from "react";
import { View, Modal, Platform, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  Button,
  GooglePlacesInput,
  Input,
  SheetFormHeader,
} from "@/components";
import type { T_GOOGLE_PLACE_META } from "@/components/ui/GooglePlacesInput/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { T_CREATE_TRAVEL_PLAN_INPUT } from "@/services/supabase/useTravelPlans";

type Props = {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: T_CREATE_TRAVEL_PLAN_INPUT) => Promise<void>;
};

function placeOk(place: T_GOOGLE_PLACE_META | null) {
  if (!place?.address?.trim()) return false;
  return (
    place.latitude != null &&
    place.longitude != null &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  );
}

export default function CreateTravelPlanModal({
  visible,
  saving,
  onClose,
  onCreate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [startPlace, setStartPlace] = useState<T_GOOGLE_PLACE_META | null>(
    null,
  );
  const [endPlace, setEndPlace] = useState<T_GOOGLE_PLACE_META | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setEventName("");
      setStartAddress("");
      setEndAddress("");
      setStartPlace(null);
      setEndPlace(null);
      setAttempted(false);
    }
  }, [visible]);

  const startError =
    attempted && !placeOk(startPlace)
      ? "Choose a start location from suggestions with map pin."
      : undefined;
  const endError =
    attempted && !placeOk(endPlace)
      ? "Choose a destination from suggestions with map pin."
      : undefined;

  const submit = async () => {
    setAttempted(true);
    if (!title.trim()) {
      Alert.alert("Missing", "Enter a trip name.");
      return;
    }
    if (!placeOk(startPlace) || !placeOk(endPlace)) {
      Alert.alert(
        "Missing",
        "Select both start and destination from the suggestions list so we can save coordinates.",
      );
      return;
    }

    await onCreate({
      title: title.trim(),
      start_location: startPlace!.address.trim(),
      end_location: endPlace!.address.trim(),
      start_lat: startPlace!.latitude,
      start_lng: startPlace!.longitude,
      end_lat: endPlace!.latitude,
      end_lng: endPlace!.longitude,
      departure_date: null,
      event_name: eventName.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Create travel plan" onClose={onClose} />
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          className="px-5 py-6"
        >
          <View className="gap-y-6">
            <Input
              label="Trip name *"
              placeholder="e.g. Weekend rodeo trip"
              value={title}
              onChangeText={setTitle}
            />

            <GooglePlacesInput
              label="Starting location *"
              placeholder="Search starting location"
              value={startAddress}
              onChangeValue={(text) => {
                setStartAddress(text);
                setStartPlace(null);
              }}
              onSelectPlace={(place) => {
                if (!place) {
                  setStartPlace(null);
                  return;
                }
                setStartPlace(place);
                setStartAddress(place.address);
              }}
              errorText={startError}
            />

            <GooglePlacesInput
              label="Destination *"
              placeholder="Search destination"
              value={endAddress}
              onChangeValue={(text) => {
                setEndAddress(text);
                setEndPlace(null);
              }}
              onSelectPlace={(place) => {
                if (!place) {
                  setEndPlace(null);
                  return;
                }
                setEndPlace(place);
                setEndAddress(place.address);
              }}
              errorText={endError}
            />

            <Input
              label="Event name (optional)"
              placeholder="e.g. State championship"
              value={eventName}
              onChangeText={setEventName}
            />

            <Button
              title="Create plan"
              onPress={() =>
                void submit().catch((e: unknown) =>
                  Alert.alert(
                    "Error",
                    e instanceof Error ? e.message : "Could not create plan",
                  ),
                )
              }
              loading={saving}
            />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}
