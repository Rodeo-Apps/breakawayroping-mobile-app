import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Button, Dropdown, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useReportReasonOptions } from "@/services/supabase/useReportReasonOptions";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";

type T_REPORT_KIND =
  | "user"
  | "group"
  | "post"
  | "comment"
  | "message";

const ReportContentScreen = () => {
  const { profile } = useAuth();
  const { kind, targetId, title, reportedUserId } = useLocalSearchParams<{
    kind?: string;
    targetId?: string;
    title?: string;
    reportedUserId?: string;
  }>();
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;

  const targetIdStr =
    typeof targetId === "string"
      ? targetId
      : Array.isArray(targetId)
        ? targetId[0] ?? ""
        : "";

  useTrackScreenFocus("messages_report", {
    kind: kind ?? "",
    target_id: targetIdStr,
  });

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    dropdownOptions: reasonOptions,
    loading: reasonsLoading,
    error: reasonsError,
    refresh: refreshReasons,
  } = useReportReasonOptions();

  useEffect(() => {
    if (!reason) return;
    if (
      reasonOptions.length > 0 &&
      !reasonOptions.some((o) => o.value === reason)
    ) {
      setReason("");
    }
  }, [reason, reasonOptions]);

  const normalizedKind = useMemo((): T_REPORT_KIND | null => {
    if (
      kind === "user" ||
      kind === "group" ||
      kind === "post" ||
      kind === "comment" ||
      kind === "message"
    ) {
      return kind;
    }
    return null;
  }, [kind]);

  const reportedUserIdStr =
    typeof reportedUserId === "string"
      ? reportedUserId
      : Array.isArray(reportedUserId)
        ? reportedUserId[0] ?? ""
        : "";

  const displayTitle =
    (typeof title === "string" ? title : Array.isArray(title) ? title[0] : "") ||
    "Report";

  const target =
    typeof targetId === "string"
      ? targetId
      : Array.isArray(targetId)
        ? targetId[0]
        : undefined;

  const canSubmit =
    !!profile?.id && !!normalizedKind && !!target && !!reason && !submitting;

  const onSubmit = async () => {
    if (!profile?.id || !normalizedKind || !target || !reason) return;
    try {
      setSubmitting(true);
      const row = {
        reporter_id: profile.id,
        reported_user_id:
          normalizedKind === "user"
            ? target
            : reportedUserIdStr || null,
        reported_content_id:
          normalizedKind === "user" ? null : target,
        reported_content_type: normalizedKind,
        reason,
        description: description.trim() || null,
      };
      const { error } = await supabase.from("user_reports").insert(row);
      if (error) throw error;
      showAlert("Thanks — your report was sent.", "success");
      router.back();
    } catch (e: any) {
      showAlert(
        typeof e?.message === "string" ? e.message : "Could not submit report.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!normalizedKind || !target) {
    return (
      <View className="flex-1 bg-background">
        <View className="px-5 py-4 flex-row items-center justify-between bg-background-secondary border-b border-border">
          <Pressable
            className="bg-background w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={primaryTextColor} />
          </Pressable>
          <Typography.SubHeading1 className="text-primaryText">Report</Typography.SubHeading1>
          <View className="w-10 h-10" />
        </View>
        <ScreenWrapper>
          <Typography.Body2 className="text-secondaryText px-5 py-6">
            Missing report details. Go back and try again.
          </Typography.Body2>
        </ScreenWrapper>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 py-4 flex-row items-center justify-between bg-background-secondary border-b border-border">
        <Pressable
          className="bg-background w-10 h-10 rounded-full items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={primaryTextColor} />
        </Pressable>
        <Typography.SubHeading1 className="text-primaryText">Report</Typography.SubHeading1>
        <View className="w-10 h-10" />
      </View>

      <ScreenWrapper withoutTPadding withoutBPadding>
        <KeyboardAwareScrollView
          className="flex-1"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="px-5 py-6 gap-y-5"
        >
          <Typography.Body2 className="text-secondaryText">
            {normalizedKind === "group"
              ? `Report group: ${displayTitle}`
              : normalizedKind === "post"
                ? `Report post: ${displayTitle}`
                : normalizedKind === "comment"
                  ? `Report comment: ${displayTitle}`
                  : normalizedKind === "message"
                    ? `Report message: ${displayTitle}`
                    : `Report user: ${displayTitle}`}
          </Typography.Body2>

          {reasonsLoading ? (
            <View className="gap-y-2 py-4 items-center justify-center">
              <Typography.SubHeading2 className="text-primaryText self-start w-full">
                Reason
              </Typography.SubHeading2>
              <ActivityIndicator />
            </View>
          ) : reasonsError ? (
            <View className="gap-y-3 py-2">
              <Typography.Body2 className="text-danger">{reasonsError}</Typography.Body2>
              <Button title="Try again" onPress={() => void refreshReasons()} variant="outlined" />
            </View>
          ) : reasonOptions.length === 0 ? (
            <Typography.Body2 className="text-secondaryText">
              No report reasons are available. Ask an admin to add rows to report_reason_options.
            </Typography.Body2>
          ) : (
            <Dropdown
              label="Reason"
              placeholder="Select a reason"
              value={reason}
              onChangeValue={(v) =>
                setReason(typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : reason)
              }
              options={reasonOptions}
            />
          )}

          <View className="gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Details (optional)
            </Typography.SubHeading2>
            <View className="bg-background-secondary rounded-2xl border border-border px-4 py-3 min-h-[120px]">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add context that helps us review this report"
                placeholderTextColor={secondaryTextColor}
                multiline
                textAlignVertical="top"
                className={`text-primaryText text-base min-h-[100px] ${description ? "font-poppins-medium" : ""}`}
              />
            </View>
          </View>

          <Button
            title="Submit report"
            loading={submitting}
            onPress={canSubmit ? () => void onSubmit() : undefined}
          />
        </KeyboardAwareScrollView>
      </ScreenWrapper>
    </View>
  );
};

export default ReportContentScreen;
