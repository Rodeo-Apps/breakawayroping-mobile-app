import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useBlockedUsersContext } from "@/provider/BlockedUsersProvider";
import { showAlert } from "@/utils/toast";
import type {
  T_ContentModerationParams,
  T_ReportableContentType,
} from "./types";

const paramString = (value?: string | string[]): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
};

const ContentModerationOptionsScreen = () => {
  const { profile } = useAuth();
  const { isBlockedByMe, blockUser, unblockUser } = useBlockedUsersContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<T_ContentModerationParams>();

  const targetUserId = paramString(params.targetUserId);
  const contentId = paramString(params.contentId);
  const displayTitle = paramString(params.displayTitle) || "this user";
  const contentType = useMemo((): T_ReportableContentType | null => {
    const raw = paramString(params.contentType);
    if (
      raw === "user" ||
      raw === "post" ||
      raw === "comment" ||
      raw === "message" ||
      raw === "group"
    ) {
      return raw;
    }
    return contentId ? "post" : "user";
  }, [params.contentType, contentId]);

  const dangerColor = useCSSVariable("--color-danger") as string;
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const [working, setWorking] = useState(false);

  const isSelf = !!(profile?.id && targetUserId && profile.id === targetUserId);
  const alreadyBlocked = isBlockedByMe(targetUserId);

  const openReport = useCallback(() => {
    if (!targetUserId || !contentType) return;
    router.push({
      pathname: "/report",
      params: {
        kind: contentType,
        targetId: contentType === "user" ? targetUserId : contentId || targetUserId,
        reportedUserId: targetUserId,
        title: displayTitle,
      },
    });
  }, [contentId, contentType, displayTitle, targetUserId]);

  const confirmBlock = useCallback(() => {
    if (!targetUserId || isSelf) return;

    Alert.alert(
      alreadyBlocked ? "Unblock user?" : "Block user?",
      alreadyBlocked
        ? `${displayTitle} will be able to interact with you again.`
        : `You will no longer see posts, messages, or profile content from ${displayTitle}. They will not be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: alreadyBlocked ? "Unblock" : "Block",
          style: alreadyBlocked ? "default" : "destructive",
          onPress: () => {
            void (async () => {
              setWorking(true);
              try {
                const error = alreadyBlocked
                  ? await unblockUser(targetUserId)
                  : await blockUser(targetUserId);
                if (error) {
                  showAlert(
                    typeof error.message === "string"
                      ? error.message
                      : "Could not update block status.",
                    "error",
                  );
                  return;
                }
                showAlert(
                  alreadyBlocked ? "User unblocked." : "User blocked.",
                  "success",
                );
                router.back();
              } finally {
                setWorking(false);
              }
            })();
          },
        },
      ],
    );
  }, [
    alreadyBlocked,
    blockUser,
    displayTitle,
    isSelf,
    targetUserId,
    unblockUser,
  ]);

  if (!targetUserId) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Options" onClose={() => router.back()} />
        <View className="px-5 py-6">
          <Typography.Body1 className="text-secondaryText">
            Missing user information.
          </Typography.Body1>
        </View>
      </View>
    );
  }

  if (isSelf) {
    return (
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Options" onClose={() => router.back()} />
        <View className="px-5 py-6">
          <Typography.Body1 className="text-secondaryText">
            You cannot report or block yourself.
          </Typography.Body1>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 16 }}
    >
      <SheetFormHeader title="Options" onClose={() => router.back()} />
      <View className="px-5 py-6 gap-y-3">
        <Typography.Body2 className="text-secondaryText pb-1">
          {displayTitle}
        </Typography.Body2>

        <Pressable
          onPress={openReport}
          disabled={working}
          className="flex-row items-center gap-x-3 rounded-2xl bg-background-secondary p-4 border border-border"
          accessibilityRole="button"
          accessibilityLabel="Report"
        >
          <Ionicons name="flag-outline" size={22} color={primaryTextColor} />
          <Typography.Body1 className="text-primaryText font-poppins-semibold flex-1">
            Report
          </Typography.Body1>
        </Pressable>

        <Pressable
          onPress={confirmBlock}
          disabled={working}
          className="flex-row items-center gap-x-3 rounded-2xl bg-background-secondary p-4 border border-border"
          accessibilityRole="button"
          accessibilityLabel={alreadyBlocked ? "Unblock user" : "Block user"}
        >
          {working ? (
            <ActivityIndicator color={dangerColor} />
          ) : (
            <Ionicons
              name={alreadyBlocked ? "person-add-outline" : "ban-outline"}
              size={22}
              color={dangerColor}
            />
          )}
          <Typography.Body1 className="text-danger font-poppins-semibold flex-1">
            {alreadyBlocked ? "Unblock user" : "Block user"}
          </Typography.Body1>
        </Pressable>
      </View>
    </View>
  );
};

export default ContentModerationOptionsScreen;
