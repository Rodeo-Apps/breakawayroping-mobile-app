import React, { useEffect, useState } from "react";
import { View, Modal, Platform, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  Button,
  Dropdown,
  GooglePlacesInput,
  Input,
  SheetFormHeader,
} from "@/components";
import type { T_GOOGLE_PLACE_META } from "@/components/ui/GooglePlacesInput/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { T_ARENA_ROW } from "@/services/supabase/arenaTypes";

const ARENA_TYPE_OPTIONS = [
  { label: "Practice", value: "practice" },
  { label: "Competition", value: "competition" },
  { label: "Both", value: "both" },
];

type FormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  addressSelected: boolean;
  arena_type: string;
  amenities: string;
  phone: string;
  website: string;
};

const emptyForm = (): FormState => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  latitude: null,
  longitude: null,
  addressSelected: false,
  arena_type: "practice",
  amenities: "",
  phone: "",
  website: "",
});

function fromArena(a: T_ARENA_ROW): FormState {
  return {
    name: a.name ?? "",
    address: a.address ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    zip: a.zip ?? "",
    latitude: a.latitude != null ? Number(a.latitude) : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
    addressSelected:
      !!a.address?.trim() &&
      a.latitude != null &&
      a.longitude != null,
    arena_type: a.arena_type ?? "practice",
    amenities: (a.amenities || []).join(", "),
    phone: a.phone ?? "",
    website: a.website ?? "",
  };
}

type Props = {
  visible: boolean;
  mode: "add" | "edit";
  arena: T_ARENA_ROW | null;
  saving: boolean;
  userId: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export default function ArenaFormSheet({
  visible,
  mode,
  arena,
  saving,
  userId,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!visible) {
      setForm(emptyForm());
      setAttempted(false);
      return;
    }
    if (mode === "edit" && arena) {
      setForm(fromArena(arena));
    } else {
      setForm(emptyForm());
    }
  }, [visible, mode, arena]);

  const addressError =
    attempted && !form.addressSelected
      ? "Select an address from suggestions."
      : attempted &&
          (form.latitude === null || form.longitude === null)
        ? "Pick a place that includes map location."
        : undefined;

  const submit = async () => {
    setAttempted(true);
    if (!form.name.trim()) {
      Alert.alert("Missing", "Enter an arena name.");
      return;
    }
    if (!form.addressSelected || !form.address.trim()) {
      Alert.alert("Missing", "Choose a valid address from suggestions.");
      return;
    }
    if (form.latitude === null || form.longitude === null) {
      Alert.alert("Missing", "Address needs latitude and longitude.");
      return;
    }

    const amenitiesArray = form.amenities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const base: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      phone: form.phone.trim() || null,
      email: null,
      website: form.website.trim() || null,
      hours: {},
      arena_type: form.arena_type,
      amenities: amenitiesArray,
      pricing: {},
      latitude: form.latitude,
      longitude: form.longitude,
      description: null,
    };

    if (mode === "add") {
      await onSave({
        ...base,
        owner_id: userId,
        rating: 0,
        review_count: 0,
        photos: [],
        is_active: true,
      });
    } else if (arena) {
      await onSave({
        ...base,
        description: arena.description,
        hours: arena.hours ?? {},
        pricing: arena.pricing ?? {},
        photos: arena.photos ?? [],
        is_active: arena.is_active,
        rating: arena.rating,
        review_count: arena.review_count,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={
        Platform.OS === "ios" ? "pageSheet" : undefined
      }
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <SheetFormHeader
          title={mode === "add" ? "Add arena" : "Edit arena"}
          onClose={onClose}
        />
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          className="px-5 py-6"
        >
          <View className="gap-y-6">
          <Input
            label="Arena name *"
            placeholder="Arena name"
            value={form.name}
            onChangeText={(text) =>
              setForm((f) => ({ ...f, name: text }))
            }
          />

          <GooglePlacesInput
            label="Address *"
            placeholder="Search for arena address"
            value={form.address}
            onChangeValue={(text) => {
              setForm((prev) => ({
                ...prev,
                address: text,
                city: "",
                state: "",
                zip: "",
                latitude: null,
                longitude: null,
                addressSelected: false,
              }));
            }}
            onSelectPlace={(place: T_GOOGLE_PLACE_META | null) => {
              if (!place) {
                setForm((prev) => ({
                  ...prev,
                  addressSelected: false,
                  latitude: null,
                  longitude: null,
                }));
                return;
              }
              const lat =
                place.latitude != null && Number.isFinite(place.latitude)
                  ? place.latitude
                  : null;
              const lng =
                place.longitude != null && Number.isFinite(place.longitude)
                  ? place.longitude
                  : null;
              const addr = place.address.trim();
              setForm((prev) => ({
                ...prev,
                address: addr,
                city: "",
                state: "",
                zip: "",
                latitude: lat,
                longitude: lng,
                addressSelected: addr.length > 0 && lat != null && lng != null,
              }));
            }}
            errorText={addressError}
          />

          <Dropdown
            label="Arena type"
            placeholder="Type"
            value={form.arena_type}
            onChangeValue={(v) =>
              setForm((f) => ({
                ...f,
                arena_type: typeof v === "string" ? v : f.arena_type,
              }))
            }
            options={ARENA_TYPE_OPTIONS}
          />

          <Input
            label="Amenities"
            placeholder="Comma separated (e.g. covered_arena, stalls)"
            value={form.amenities}
            onChangeText={(text) =>
              setForm((f) => ({ ...f, amenities: text }))
            }
          />
          <Input
            label="Phone"
            placeholder="Phone number"
            value={form.phone}
            onChangeText={(text) =>
              setForm((f) => ({ ...f, phone: text }))
            }
            inputProps={{ keyboardType: "phone-pad" }}
          />
          <Input
            label="Website"
            placeholder="https://…"
            value={form.website}
            onChangeText={(text) =>
              setForm((f) => ({ ...f, website: text }))
            }
            inputProps={{ keyboardType: "url", autoCapitalize: "none" }}
          />

          <Button
            title={mode === "add" ? "Save arena" : "Update arena"}
            onPress={() => void submit().catch((e: unknown) =>
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Could not save",
              ),
            )}
            loading={saving}
          />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}
