import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import {
  DatePicker,
  GooglePlacesInput,
  Input,
  SheetFormHeader,
  TextArea,
} from "@/components";
import { useAuth } from "@/provider/AuthProvider";
import { useHaulingMutations } from "@/services/supabase/useHaulingMutations";
import type { T_NEW_TRIP_INPUT } from "@/services/supabase/haulingTypes";
import type { T_GOOGLE_PLACE_META } from "@/components/ui/GooglePlacesInput/types";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";

const emptyTrip: T_NEW_TRIP_INPUT = {
  origin_address: "",
  origin_latitude: null,
  origin_longitude: null,
  origin_google_place_id: null,
  destination_address: "",
  destination_latitude: null,
  destination_longitude: null,
  destination_google_place_id: null,
  travel_date: "",
  departure_time: "",
  total_spots: "",
  price_per_horse: "",
  trailer_type: "",
  notes: "",
};

const placeToPatch = (
  place: T_GOOGLE_PLACE_META | null,
): Pick<
  T_NEW_TRIP_INPUT,
  | "origin_address"
  | "origin_latitude"
  | "origin_longitude"
  | "origin_google_place_id"
> => ({
  origin_address: place?.address ?? "",
  origin_latitude: place?.latitude ?? null,
  origin_longitude: place?.longitude ?? null,
  origin_google_place_id: place?.placeId ?? null,
});

const destPlaceToPatch = (
  place: T_GOOGLE_PLACE_META | null,
): Pick<
  T_NEW_TRIP_INPUT,
  | "destination_address"
  | "destination_latitude"
  | "destination_longitude"
  | "destination_google_place_id"
> => ({
  destination_address: place?.address ?? "",
  destination_latitude: place?.latitude ?? null,
  destination_longitude: place?.longitude ?? null,
  destination_google_place_id: place?.placeId ?? null,
});

const PostTripScreen = () => {
  useTrackScreenFocus("hauling_post_trip");
  const { profile } = useAuth();
  const { postTrip } = useHaulingMutations(profile?.id);
  const [form, setForm] = useState<T_NEW_TRIP_INPUT>(emptyTrip);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<T_NEW_TRIP_INPUT>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await postTrip(form);
      showAlert("Trip posted successfully.", "success");
      router.back();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not post trip.";
      showAlert(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="Post trip"
        onClose={() => router.back()}
        primaryAction={{
          label: "Post",
          onPress: () => void handleSubmit(),
          loading: submitting,
        }}
      />

      <KeyboardAwareScrollView
        className="flex-1 px-5 pt-4"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
      >
          <View className="mb-3">
            <GooglePlacesInput
              label="Origin *"
              placeholder="Search starting point"
              value={form.origin_address}
              onChangeValue={(t) =>
                update({
                  origin_address: t,
                  origin_latitude: null,
                  origin_longitude: null,
                  origin_google_place_id: null,
                })
              }
              onSelectPlace={(place) => update(placeToPatch(place))}
            />
          </View>

          <View className="mb-3">
            <GooglePlacesInput
              label="Destination *"
              placeholder="Search destination"
              value={form.destination_address}
              onChangeValue={(t) =>
                update({
                  destination_address: t,
                  destination_latitude: null,
                  destination_longitude: null,
                  destination_google_place_id: null,
                })
              }
              onSelectPlace={(place) => update(destPlaceToPatch(place))}
            />
          </View>

          <View className="mb-3">
            <DatePicker
              label="Travel date"
              value={form.travel_date}
              onChangeValue={(v) => update({ travel_date: v })}
            />
          </View>

          <View className="mb-3">
            <Input
              placeholder="Departure time (optional, e.g. 08:00)"
              value={form.departure_time}
              onChangeText={(t) => update({ departure_time: t })}
            />
          </View>

          <View className="mb-3">
            <Input
              placeholder="Total spots *"
              value={form.total_spots}
              onChangeText={(t) => update({ total_spots: t })}
              inputProps={{ keyboardType: "number-pad" }}
            />
          </View>

          <View className="mb-3">
            <Input
              placeholder="Price per horse ($, 0 for free)"
              value={form.price_per_horse}
              onChangeText={(t) => update({ price_per_horse: t })}
              inputProps={{ keyboardType: "number-pad" }}
            />
          </View>

          <View className="mb-3">
            <Input
              placeholder="Trailer type (optional)"
              value={form.trailer_type}
              onChangeText={(t) => update({ trailer_type: t })}
            />
          </View>

          <View className="mb-8">
            <TextArea
              label="Notes (optional)"
              placeholder="Anything riders should know…"
              value={form.notes}
              onChangeText={(t) => update({ notes: t })}
            />
          </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default PostTripScreen;
