import React, { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Dropdown,
  GooglePlacesInput,
  Input,
  SheetFormHeader,
  TextArea,
} from "@/components";
import type { T_GOOGLE_PLACE_META } from "@/components/ui/GooglePlacesInput/types";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useMarketplaceListingMutations } from "@/services/supabase/useMarketplaceListingMutations";
import type {
  T_MARKETPLACE_LISTING_CATEGORY,
  T_MARKETPLACE_PAYMENT_TYPE,
} from "@/services/supabase/marketplaceTypes";
import {
  computeMarketplaceFees,
  formatCents,
} from "@/services/stripe/marketplaceFees";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";

const MAX_PHOTOS = 8;

const CATEGORY_OPTIONS = [
  { value: "horse", label: "Horse" },
  { value: "saddle", label: "Saddle" },
  { value: "tack", label: "Tack" },
  { value: "trailer", label: "Trailer" },
  { value: "gear", label: "Gear" },
  { value: "apparel", label: "Apparel" },
  { value: "other", label: "Other" },
];

const PAYMENT_TYPE_OPTIONS: {
  value: T_MARKETPLACE_PAYMENT_TYPE;
  label: string;
  helper: string;
}[] = [
  {
    value: "arrange_yourself",
    label: "Arrange it yourself",
    helper:
      "Best for horses & trailers. Buyer pays you directly (Venmo, PayPal, Cash App, Zelle or cash). No money moves through the app.",
  },
  {
    value: "stripe",
    label: "Pay securely in-app",
    helper:
      "Best for tack, saddles & gear. Buyer checks out with a card in the app. Zero platform commission — only Stripe's processing fee applies.",
  },
];

const CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const MarketplaceNewListingScreen = () => {
  useTrackScreenFocus("marketplace_new_listing");
  const { profile } = useAuth();
  const { submitting, createListing } = useMarketplaceListingMutations(profile?.id);

  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("horse");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("good");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<T_GOOGLE_PLACE_META | null>(null);
  const [contactPhone, setContactPhone] = useState(false);
  const [contactEmail, setContactEmail] = useState(true);
  const [contactMessage, setContactMessage] = useState(true);
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const [paymentType, setPaymentType] =
    useState<T_MARKETPLACE_PAYMENT_TYPE>("arrange_yourself");
  const [feeSplit, setFeeSplit] = useState(false);
  const [venmo, setVenmo] = useState("");
  const [paypal, setPaypal] = useState("");
  const [cashapp, setCashapp] = useState("");
  const [zelle, setZelle] = useState("");
  const [acceptsCash, setAcceptsCash] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("horse");
    setPrice("");
    setCondition("good");
    setLocationQuery("");
    setSelectedPlace(null);
    setContactPhone(false);
    setContactEmail(true);
    setContactMessage(true);
    setPhotoUris([]);
    setPaymentType("arrange_yourself");
    setFeeSplit(false);
    setVenmo("");
    setPaypal("");
    setCashapp("");
    setZelle("");
    setAcceptsCash(false);
  };

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Please allow photo library access.", "warning");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUris((prev) =>
      [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS),
    );
  };

  const handleClose = () => {
    reset();
    router.back();
  };

  const handleSubmit = async () => {
    if (!profile?.id) {
      showAlert("Sign in to create a listing.", "warning");
      return;
    }
    if (!title.trim() || !description.trim() || !price.trim()) {
      showAlert("Title, description, and price are required.", "warning");
      return;
    }
    const n = parseFloat(price);
    if (Number.isNaN(n) || n < 0) {
      showAlert("Enter a valid price.", "warning");
      return;
    }
    if (photoUris.length === 0) {
      showAlert("Add at least one photo.", "warning");
      return;
    }
    const trimmedLocation = locationQuery.trim();
    if (trimmedLocation && !selectedPlace?.address) {
      showAlert(
        "Choose an address from the suggestions to save the location.",
        "warning",
      );
      return;
    }

    const handles = {
      venmo: venmo.trim() || null,
      paypal: paypal.trim() || null,
      cashapp: cashapp.trim() || null,
      zelle: zelle.trim() || null,
    };
    const hasAnyHandle =
      !!handles.venmo || !!handles.paypal || !!handles.cashapp || !!handles.zelle;

    if (paymentType === "arrange_yourself" && !hasAnyHandle && !acceptsCash) {
      showAlert(
        "Add at least one payment handle (Venmo, PayPal, Cash App or Zelle) or accept cash.",
        "warning",
      );
      return;
    }
    if (paymentType === "stripe" && n <= 0) {
      showAlert("In-app payment requires a price greater than $0.", "warning");
      return;
    }

    try {
      await createListing(
        {
          title: title.trim(),
          description: description.trim(),
          category: category as T_MARKETPLACE_LISTING_CATEGORY,
          price: n,
          condition: condition || null,
          location_address: selectedPlace?.address?.trim() || null,
          latitude:
            selectedPlace?.latitude != null &&
            Number.isFinite(selectedPlace.latitude)
              ? selectedPlace.latitude
              : null,
          longitude:
            selectedPlace?.longitude != null &&
            Number.isFinite(selectedPlace.longitude)
              ? selectedPlace.longitude
              : null,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          contact_message: contactMessage,
          payment_type: paymentType,
          fee_split: paymentType === "stripe" ? feeSplit : false,
          payment_handles:
            paymentType === "arrange_yourself" ? handles : null,
          accepts_cash: paymentType === "arrange_yourself" ? acceptsCash : false,
        },
        photoUris,
      );
      reset();
      router.back();
      showAlert("Listing created.", "success");
    } catch (e: unknown) {
      showAlert(
        typeof e === "object" && e && "message" in e
          ? String((e as { message: string }).message)
          : "Could not create listing.",
        "error",
      );
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title="New listing"
        onClose={handleClose}
        primaryAction={{
          label: "Publish",
          onPress: () => void handleSubmit(),
          loading: submitting,
        }}
      />

      <KeyboardAwareScrollView
        className="flex-1 px-5 py-5"
        contentContainerClassName="gap-y-4 pb-28"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="Title"
          placeholder="What are you selling?"
          value={title}
          onChangeText={setTitle}
        />
        <TextArea
          label="Description"
          placeholder="Describe condition, size, etc."
          value={description}
          onChangeText={setDescription}
        />
        <Dropdown
          label="Category"
          placeholder="Category"
          value={category}
          onChangeValue={(v) => setCategory(typeof v === "string" ? v : category)}
          options={CATEGORY_OPTIONS}
        />
        <Input
          label="Price (USD)"
          placeholder="0.00"
          value={price}
          onChangeText={setPrice}
          inputProps={{ keyboardType: "decimal-pad" }}
        />
        <Dropdown
          label="Condition"
          placeholder="Condition"
          value={condition}
          onChangeValue={(v) => setCondition(typeof v === "string" ? v : condition)}
          options={CONDITION_OPTIONS}
        />
        <GooglePlacesInput
          label="Address (optional)"
          placeholder="Search address"
          value={locationQuery}
          onChangeValue={setLocationQuery}
          onSelectPlace={(place) => {
            setSelectedPlace(place);
            if (place?.address) setLocationQuery(place.address);
          }}
        />

        <Typography.SubHeading2 className="text-primaryText pt-2">
          How do you want to get paid?
        </Typography.SubHeading2>
        <View className="gap-y-2">
          {PAYMENT_TYPE_OPTIONS.map((opt) => {
            const active = paymentType === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPaymentType(opt.value)}
                className={`rounded-2xl border p-3 gap-y-1 ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background-secondary"
                }`}
              >
                <View className="flex-row items-center gap-x-2">
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? primaryTextColor : secondaryTextColor}
                  />
                  <Typography.SubHeading2 className="text-primaryText">
                    {opt.label}
                  </Typography.SubHeading2>
                </View>
                <Typography.Caption1 className="text-secondaryText">
                  {opt.helper}
                </Typography.Caption1>
              </Pressable>
            );
          })}
        </View>

        {paymentType === "arrange_yourself" && (
          <View className="gap-y-3">
            <Typography.Caption1 className="text-secondaryText">
              Share the handles buyers can use to pay you. Add at least one, or
              accept cash.
            </Typography.Caption1>
            <Input
              label="Venmo"
              placeholder="@your-venmo"
              value={venmo}
              onChangeText={setVenmo}
            />
            <Input
              label="PayPal"
              placeholder="you@email.com or PayPal.Me link"
              value={paypal}
              onChangeText={setPaypal}
            />
            <Input
              label="Cash App"
              placeholder="$yourcashtag"
              value={cashapp}
              onChangeText={setCashapp}
            />
            <Input
              label="Zelle"
              placeholder="Email or phone number"
              value={zelle}
              onChangeText={setZelle}
            />
            <Pressable
              className="flex-row items-center justify-between py-2"
              onPress={() => setAcceptsCash((v) => !v)}
            >
              <Typography.Body2 className="text-primaryText">
                Accept cash in person
              </Typography.Body2>
              <Ionicons
                name={acceptsCash ? "checkbox" : "square-outline"}
                size={24}
                color={acceptsCash ? primaryTextColor : secondaryTextColor}
              />
            </Pressable>
          </View>
        )}

        {paymentType === "stripe" && (
          <View className="gap-y-3">
            <Pressable
              className="flex-row items-center justify-between py-2"
              onPress={() => setFeeSplit((v) => !v)}
            >
              <View className="flex-1 pr-3">
                <Typography.Body2 className="text-primaryText">
                  Split the Stripe fee 50/50
                </Typography.Body2>
                <Typography.Caption1 className="text-secondaryText">
                  Off: buyer pays the full processing fee. On: you cover half.
                </Typography.Caption1>
              </View>
              <Ionicons
                name={feeSplit ? "checkbox" : "square-outline"}
                size={24}
                color={feeSplit ? primaryTextColor : secondaryTextColor}
              />
            </Pressable>
            {(() => {
              const n = parseFloat(price);
              if (Number.isNaN(n) || n <= 0) return null;
              const fees = computeMarketplaceFees(n, feeSplit);
              return (
                <View className="rounded-2xl border border-border bg-background-secondary p-3 gap-y-1">
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Buyer pays
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {formatCents(fees.buyerTotalCents)}
                    </Typography.Caption1>
                  </View>
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      Stripe fee ({feeSplit ? "your half" : "buyer pays"})
                    </Typography.Caption1>
                    <Typography.Caption1 className="text-primaryText">
                      {formatCents(
                        feeSplit ? fees.sellerFeeCents : fees.buyerFeeCents,
                      )}
                    </Typography.Caption1>
                  </View>
                  <View className="flex-row justify-between">
                    <Typography.Caption1 className="text-secondaryText">
                      You receive
                    </Typography.Caption1>
                    <Typography.SubHeading2 className="text-primary">
                      {formatCents(fees.sellerNetCents)}
                    </Typography.SubHeading2>
                  </View>
                  <Typography.Caption1 className="text-secondaryText pt-1">
                    Zero platform commission — Breakaway Connect never takes a cut.
                  </Typography.Caption1>
                </View>
              );
            })()}
          </View>
        )}

        <Typography.SubHeading2 className="text-primaryText pt-2">
          Photos (max {MAX_PHOTOS})
        </Typography.SubHeading2>
        <View className="flex-row flex-wrap gap-2">
          {photoUris.map((uri) => (
            <View
              key={uri}
              className="w-20 h-20 rounded-xl overflow-hidden border border-border"
            >
              <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
            </View>
          ))}
          {photoUris.length < MAX_PHOTOS && (
            <Pressable
              onPress={() => void pickPhotos()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border items-center justify-center bg-background-secondary"
            >
              <Ionicons name="add" size={28} color={secondaryTextColor} />
            </Pressable>
          )}
        </View>

        <Typography.SubHeading2 className="text-primaryText pt-2">
          Contact options
        </Typography.SubHeading2>
        <Pressable
          className="flex-row items-center justify-between py-2"
          onPress={() => setContactMessage((v) => !v)}
        >
          <Typography.Body2 className="text-primaryText">
            Allow in-app messages
          </Typography.Body2>
          <Ionicons
            name={contactMessage ? "checkbox" : "square-outline"}
            size={24}
            color={contactMessage ? primaryTextColor : secondaryTextColor}
          />
        </Pressable>
        <Pressable
          className="flex-row items-center justify-between py-2"
          onPress={() => setContactEmail((v) => !v)}
        >
          <Typography.Body2 className="text-primaryText">Show email</Typography.Body2>
          <Ionicons
            name={contactEmail ? "checkbox" : "square-outline"}
            size={24}
            color={contactEmail ? primaryTextColor : secondaryTextColor}
          />
        </Pressable>
        <Pressable
          className="flex-row items-center justify-between py-2"
          onPress={() => setContactPhone((v) => !v)}
        >
          <Typography.Body2 className="text-primaryText">Show phone</Typography.Body2>
          <Ionicons
            name={contactPhone ? "checkbox" : "square-outline"}
            size={24}
            color={contactPhone ? primaryTextColor : secondaryTextColor}
          />
        </Pressable>

        <View className="h-6" />
      </KeyboardAwareScrollView>
    </View>
  );
};

export default MarketplaceNewListingScreen;
