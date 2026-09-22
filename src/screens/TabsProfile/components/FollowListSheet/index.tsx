import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, SheetFormHeader } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  useFollowList,
  type T_FOLLOW_LIST_USER,
} from "@/services/supabase/useFollowList";
import type { T_FOLLOW_LIST_KIND } from "./types";

function normalizeKind(raw: string | string[] | undefined): T_FOLLOW_LIST_KIND {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return v === "following" ? "following" : "followers";
}

const FollowListSheet: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string | string[] }>();
  const kind = normalizeKind(kindParam);

  const title = kind === "followers" ? "Followers" : "Following";

  const { loading, users, error, refresh, resolveAvatarUri } = useFollowList(
    profile?.id,
    kind,
  );

  const onClose = useCallback(() => {
    router.back();
  }, []);

  const openUser = useCallback(
    (userId: string) => {
      if (!userId) return;
      if (profile?.id === userId) {
        router.back();
        return;
      }
      router.back();
      setTimeout(() => {
        router.push(`/user/${userId}`);
      }, 380);
    },
    [profile?.id],
  );

  const renderItem = useCallback(
    ({ item }: { item: T_FOLLOW_LIST_USER }) => {
      const uri = resolveAvatarUri(item.avatar_url);
      const label = item.name?.trim() || item.username || "Member";
      return (
        <Pressable
          onPress={() => openUser(item.id)}
          className="flex-row items-center gap-x-3 px-5 py-3 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`Open profile ${label}`}
        >
          {uri ? (
            <Image
              source={{ uri }}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <Avatar uri={null} name={label} className="w-12 h-12" />
          )}
          <View className="flex-1 min-w-0">
            <Typography.Body1 className="text-primaryText font-poppins-semibold">
              {label}
            </Typography.Body1>
            {!!item.username && (
              <Typography.Caption1 className="text-secondaryText">
                {`@${item.username}`}
              </Typography.Caption1>
            )}
          </View>
        </Pressable>
      );
    },
    [openUser, resolveAvatarUri],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View className="py-16 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      );
    }
    if (error) {
      return (
        <View className="px-5 py-10">
          <Typography.Body2 className="text-secondaryText text-center">
            {error}
          </Typography.Body2>
        </View>
      );
    }
    return (
      <View className="px-5 py-10">
        <Typography.Body2 className="text-secondaryText text-center">
          {kind === "followers"
            ? "No followers yet."
            : "Not following anyone yet."}
        </Typography.Body2>
      </View>
    );
  }, [loading, error, kind]);

  const keyExtractor = useCallback((item: T_FOLLOW_LIST_USER) => item.id, []);

  /** iOS page sheets: SheetFormHeader uses 0 top inset; Android already applies insets.top inside the header. */
  const headerTopPadding =
    Platform.OS === "ios" ? Math.max(insets.top, 12) + 12 : 12;

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: headerTopPadding }}>
        <SheetFormHeader title={title} onClose={onClose} />
      </View>
      <FlatList
        data={users}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmpty}
        onRefresh={() => void refresh()}
        refreshing={loading && users.length > 0}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24),
          flexGrow: 1,
        }}
      />
    </View>
  );
};

export default FollowListSheet;
