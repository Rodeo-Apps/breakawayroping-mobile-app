import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, Input, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";
import {
  HEIGHT_EXPLAINER,
  MAX_WALKAROUND_MS,
  WALKAROUND_INSTRUCTIONS,
  WALKAROUND_VIEWS,
} from "@/constants/walkaroundViews";
import {
  handsToInches,
  useBaselineCapture,
  validateWalkaroundDuration,
} from "@/services/supabase/baseline";

/**
 * Capture the standing walk-around.
 *
 * The screen is mostly instructions on purpose. Everything downstream depends
 * on this one clip being framed properly, and a re-shoot costs the rider a trip
 * to the barn — so it is worth being explicit before they film rather than
 * apologetic afterwards.
 */

const PHASE_LABELS: Record<string, string> = {
  extracting: "Reading the views from your clip...",
  uploading: "Uploading...",
  saving: "Saving...",
  analyzing: "Measuring the horse and rider... this takes a minute.",
};

const BaselineCaptureScreen = () => {
  const primary = useCSSVariable("--color-primary") as string;
  const accent = useCSSVariable("--color-accent") as string;
  const { capture, submitting, progress, error } = useBaselineCapture();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [horseName, setHorseName] = useState("");
  const [hands, setHands] = useState("");
  const [riderHeight, setRiderHeight] = useState("");

  const handsValue = useMemo(() => {
    const parsed = Number.parseFloat(hands.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }, [hands]);

  const handsInches = useMemo(() => handsToInches(handsValue), [handsValue]);
  const handsInvalid = hands.trim().length > 0 && handsInches === null;

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: Math.round(MAX_WALKAROUND_MS / 1000),
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const ms =
      typeof asset.duration === "number" ? Math.round(asset.duration * 1000) : null;

    const check = validateWalkaroundDuration(ms);
    if (!check.valid) {
      showAlert(check.error || "That clip will not work", "warning");
      return;
    }

    setVideoUri(asset.uri);
    setDurationMs(ms);
  };

  const submit = async () => {
    if (!videoUri || submitting) return;
    if (handsInvalid) {
      showAlert("Hands are written like 15.2 — 15 hands and 2 inches.", "warning");
      return;
    }
    try {
      const parsedRider = Number.parseFloat(riderHeight);
      const baseline = await capture({
        videoUri,
        videoDurationMs: durationMs,
        horseName: horseName.trim() || null,
        horseHeightHands: handsValue,
        riderHeightInches: Number.isFinite(parsedRider) ? parsedRider : null,
      });
      router.replace(`/baseline/${baseline.id}` as never);
    } catch (e: any) {
      showAlert(e?.message ?? "Could not capture the baseline", "error");
    }
  };

  return (
    <ScreenWrapper>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
        <Typography.Heading3 className="text-primaryText">Baseline</Typography.Heading3>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Typography.Body2 className="text-secondaryText mb-4">
          One slow lap around your horse, standing still, head to hoof. We measure
          the pair once and use it as the ruler for every run after that. It says
          nothing about how you ride — it is what lets the app answer in inches
          instead of adjectives.
        </Typography.Body2>

        {/* How to film it */}
        <View className="bg-card rounded-3xl p-4 mb-4">
          <Typography.SubHeading1 className="text-primaryText mb-2">
            Before you film
          </Typography.SubHeading1>
          {WALKAROUND_INSTRUCTIONS.map((line, i) => (
            <View key={line} className="flex-row gap-x-3 py-1">
              <Typography.Body2 className="text-secondaryText">{i + 1}.</Typography.Body2>
              <Typography.Body2 className="text-secondaryText flex-1">{line}</Typography.Body2>
            </View>
          ))}
          <Typography.Caption1 className="text-secondaryText mt-2">
            We take {WALKAROUND_VIEWS.length} views out of the lap: {WALKAROUND_VIEWS.map((v) => v.label.toLowerCase()).join(", ")}.
          </Typography.Caption1>
        </View>

        {/* The clip */}
        <Pressable
          onPress={pickVideo}
          className="bg-card rounded-3xl p-4 mb-4 flex-row items-center gap-x-3"
        >
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: `${primary}22` }}
          >
            <Ionicons name={videoUri ? "checkmark" : "videocam-outline"} size={24} color={primary} />
          </View>
          <View className="flex-1">
            <Typography.SubHeading2 className="text-primaryText">
              {videoUri ? "Walk-around selected" : "Choose your walk-around clip"}
            </Typography.SubHeading2>
            <Typography.Caption1 className="text-secondaryText">
              {videoUri
                ? durationMs
                  ? `${Math.round(durationMs / 1000)} seconds`
                  : "Ready"
                : "About 20 seconds, one slow lap"}
            </Typography.Caption1>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9f9f9f" />
        </Pressable>

        {/* The one real measurement */}
        <View className="bg-card rounded-3xl p-4 mb-4 gap-y-3">
          <Typography.SubHeading1 className="text-primaryText">
            Your horse
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText">
            {HEIGHT_EXPLAINER}
          </Typography.Body2>
          <Input
            label="Horse name"
            placeholder="Optional"
            value={horseName}
            onChangeText={setHorseName}
          />
          <Input
            label="Height in hands"
            placeholder="e.g. 15.2"
            value={hands}
            onChangeText={setHands}
            errorText={
              handsInvalid
                ? "Hands are written like 15.2 — 15 hands and 2 inches. Only .0 to .3 make sense."
                : undefined
            }
            inputProps={{ keyboardType: "decimal-pad", maxLength: 5 }}
          />
          {handsInches ? (
            <Typography.Caption1 className="text-secondaryText">
              That is {handsInches} inches at the withers.
            </Typography.Caption1>
          ) : null}
          <Input
            label="Your height in inches"
            placeholder="Optional, e.g. 66"
            value={riderHeight}
            onChangeText={setRiderHeight}
            inputProps={{ keyboardType: "number-pad", maxLength: 2 }}
          />
        </View>

        {!handsValue ? (
          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: `${accent}15` }}
          >
            <Typography.Body2 className="text-secondaryText">
              Without a height we can still record proportions and use them to
              spot your horse in later clips — but measurements stay relative,
              not in inches.
            </Typography.Body2>
          </View>
        ) : null}

        {progress ? (
          <Typography.Body2 className="text-secondaryText mb-3 text-center">
            {PHASE_LABELS[progress.phase] ?? "Working..."}
          </Typography.Body2>
        ) : null}

        {error ? (
          <Typography.Body2 className="mb-3" textProps={{ style: { color: "#ef4444" } }}>
            {error}
          </Typography.Body2>
        ) : null}

        <Button
          title={submitting ? "Measuring..." : "Create baseline"}
          loading={submitting}
          onPress={videoUri && !submitting ? submit : undefined}
        />
      </ScrollView>
    </ScreenWrapper>
  );
};

export default BaselineCaptureScreen;
