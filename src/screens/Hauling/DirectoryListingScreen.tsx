import React, { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Dropdown,
  GooglePlacesInput,
  Input,
  Loader,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useHaulingMutations } from "@/services/supabase/useHaulingMutations";
import { useHauler } from "@/services/supabase/useHauler";
import type {
  T_HAULER_LISTING_INPUT,
  T_HAULER_ROW,
} from "@/services/supabase/haulingTypes";
import { haulerAddressForInput } from "@/utils/haulerLocation";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const emptyForm: T_HAULER_LISTING_INPUT = {
  business_name: "",
  address: "",
  latitude: null,
  longitude: null,
  google_place_id: null,
  service_area_states: "",
  trailer_types: "",
  capacity: "",
  price_range: "low",
};

const DirectoryListingScreen = () => {
  useTrackScreenFocus("hauling_directory_listing");
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ haulerId?: string | string[] }>();
  const haulerIdParam = params.haulerId;
  const haulerId =
    typeof haulerIdParam === "string"
      ? haulerIdParam
      : Array.isArray(haulerIdParam)
        ? haulerIdParam[0]
        : undefined;

  const {
    hauler: loadedHauler,
    loading: haulerLoading,
    error: haulerError,
  } = useHauler(haulerId || null);
  const { saveHaulerListing, deactivateHaulerListing } = useHaulingMutations(
    profile?.id,
  );

  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<T_HAULER_LISTING_INPUT>(emptyForm);
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const placeholderTextColor = useCSSVariable(
    "--color-placeholderText",
  ) as string;

  const editing: T_HAULER_ROW | null =
    haulerId && loadedHauler ? loadedHauler : null;

  useEffect(() => {
    if (!haulerId) {
      setForm(emptyForm);
      setCoverLocalUri(null);
      return;
    }
    if (!loadedHauler) return;
    setForm({
      business_name: loadedHauler.business_name,
      address: haulerAddressForInput(loadedHauler),
      latitude: loadedHauler.latitude ?? null,
      longitude: loadedHauler.longitude ?? null,
      google_place_id: loadedHauler.google_place_id ?? null,
      service_area_states: loadedHauler.service_area_states.join(", "),
      trailer_types: loadedHauler.trailer_types.join(", "),
      capacity: String(loadedHauler.capacity ?? ""),
      price_range: loadedHauler.price_range || "low",
    });
    setCoverLocalUri(null);
  }, [haulerId, loadedHauler]);

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to add a cover image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setCoverLocalUri(result.assets[0].uri);
    }
  };

  const update = (patch: Partial<T_HAULER_LISTING_INPUT>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveHaulerListing(form, editing, coverLocalUri);
      showAlert(editing ? "Listing updated." : "Listing added.", "success");
      router.back();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not save listing.";
      showAlert(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setSaving(true);
    try {
      await deactivateHaulerListing(id);
      showAlert("Listing removed.", "success");
      router.back();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not remove listing.";
      showAlert(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert("Remove listing", "Remove this hauler from the directory?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void onDelete(editing.id),
      },
    ]);
  };

  if (haulerId && haulerLoading) {
    return <Loader message="Loading listing…" />;
  }

  if (haulerId && !haulerLoading && (haulerError || !loadedHauler)) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Typography.Body1 className="text-secondaryText text-center">
          {haulerError ?? "Listing not found."}
        </Typography.Body1>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Typography.Body1 className="text-primary">Go back</Typography.Body1>
        </Pressable>
      </View>
    );
  }

  const title = editing ? "Edit Directory Listing" : "Add Directory Listing";
  const primaryLabel = editing ? "Save" : "Add";

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-5 py-4 flex-row items-center justify-between bg-background-secondary border-b border-border"
        style={{ paddingTop: Platform.OS === "android" ? insets.top : 0 }}
      >
          <Pressable
            className="bg-background w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={primaryTextColor} />
          </Pressable>

          <Typography.SubHeading1 className="text-primaryText">
            {title}
          </Typography.SubHeading1>

          <View className="w-20">
            <Button
              title={primaryLabel}
              onPress={() => void onSave()}
              loading={saving}
            />
          </View>
        </View>

      <KeyboardAwareScrollView
        className="flex-1"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10 p-5"
      >
          <View className="w-full mb-4 rounded-2xl overflow-hidden">
            <Pressable
              onPress={() => void pickCover()}
              className={`w-full max-h-52 bg-background-secondary overflow-hidden items-center justify-center active:opacity-90 border-b border-border ${
                coverLocalUri || editing?.cover_image_url ? "" : "border-dashed"
              }`}
            >
              {coverLocalUri || editing?.cover_image_url ? (
                <Image
                  source={{
                    uri: coverLocalUri ?? editing?.cover_image_url ?? "",
                  }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center gap-y-2 py-6 px-4 w-full">
                  <Ionicons
                    name="image-outline"
                    size={36}
                    color={placeholderTextColor}
                  />
                  <Typography.Body2 className="text-secondaryText text-center">
                    Cover image (optional)
                  </Typography.Body2>
                </View>
              )}
            </Pressable>
            {(coverLocalUri || editing?.cover_image_url) && (
              <View className="mt-2">
                <Pressable
                  onPress={() => void pickCover()}
                  className="self-start"
                >
                  <Typography.Caption1 className="text-primary">
                    Change cover
                  </Typography.Caption1>
                </Pressable>
              </View>
            )}
          </View>

          <View className="pt-2">
            <View className="mb-3">
              <Input
                label="Business name *"
                placeholder="Hauling Co."
                value={form.business_name}
                onChangeText={(t) => update({ business_name: t })}
              />
            </View>
            <View className="mb-3">
              <GooglePlacesInput
                label="Business address *"
                placeholder="Search for an address"
                value={form.address}
                onChangeValue={(text) => {
                  update({
                    address: text,
                    latitude: null,
                    longitude: null,
                    google_place_id: null,
                  });
                }}
                onSelectPlace={(place) => {
                  if (!place) {
                    update({
                      latitude: null,
                      longitude: null,
                      google_place_id: null,
                    });
                    return;
                  }
                  update({
                    address: place.address,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    google_place_id: place.placeId,
                  });
                }}
              />
            </View>
            <View className="mb-3">
              <Input
                label="Service area states"
                placeholder="TX, OK, NM"
                value={form.service_area_states}
                onChangeText={(t) => update({ service_area_states: t })}
              />
            </View>
            <View className="mb-3">
              <Input
                label="Trailer types"
                placeholder="slant load, stock"
                value={form.trailer_types}
                onChangeText={(t) => update({ trailer_types: t })}
              />
            </View>
            <View className="mb-3">
              <Input
                label="Capacity (horses)"
                placeholder="4"
                value={form.capacity}
                onChangeText={(t) => update({ capacity: t })}
                inputProps={{ keyboardType: "number-pad" }}
              />
            </View>
            <View className="mb-4">
              <Dropdown
                label="Price range"
                value={form.price_range}
                onChangeValue={(v) =>
                  update({
                    price_range: typeof v === "string" ? v : form.price_range,
                  })
                }
                options={[
                  { label: "Low", value: "low" },
                  { label: "Medium", value: "medium" },
                  { label: "High", value: "high" },
                ]}
              />
            </View>

            {editing ? (
              <View className="mt-3 mb-8">
                <Button
                  title="Remove listing"
                  variant="outlined"
                  onPress={confirmDelete}
                />
              </View>
            ) : (
              <View className="h-8" />
            )}
          </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default DirectoryListingScreen;
