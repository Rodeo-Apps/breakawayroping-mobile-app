import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Avatar, EmptyState, Input, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import {
  T_USER_SEARCH_RESULT,
  useUserSearch,
} from "@/services/supabase/useUserSearch";
import { useTrackScreenFocus } from "@/analytics";
import type { T_SearchUserRow } from "./types";

const displayLabel = (user: T_SearchUserRow) =>
  user.name?.trim() ||
  user.username?.trim() ||
  user.email?.trim() ||
  "Unknown User";

const UserSearchRow = ({
  user,
  onPress,
}: {
  user: T_SearchUserRow;
  onPress: (user: T_SearchUserRow) => void;
}) => (
  <Pressable
    className="rounded-2xl px-4 py-3 flex-row items-center gap-x-3 bg-background-secondary"
    onPress={() => onPress(user)}
  >
    <Avatar
      uri={user.avatar_url || undefined}
      name={displayLabel(user)}
      className="w-12 h-12"
    />
    <View className="flex-1 gap-y-0.5">
      <Typography.SubHeading2 className="text-primaryText">
        {displayLabel(user)}
      </Typography.SubHeading2>
      {!!user.email && (
        <Typography.Body2 className="text-secondaryText">
          {user.email}
        </Typography.Body2>
      )}
      {!!user.username && (
        <Typography.Caption1 className="text-secondaryText">
          @{user.username}
        </Typography.Caption1>
      )}
    </View>
    <Feather name="chevron-right" size={20} color="#9ca3af" />
  </Pressable>
);

const SearchScreen = () => {
  useTrackScreenFocus("user_search");
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--accent-color-primary") as string;

  const {
    query,
    setQuery,
    results,
    recentSearches,
    loading,
    loadingRecent,
    error,
    showResults,
    minQueryLength,
    recordRecentAndOpen,
    clearRecent,
  } = useUserSearch();

  const openUserProfile = useCallback(
    async (user: T_USER_SEARCH_RESULT) => {
      await recordRecentAndOpen(user);
      router.push(`/user/${user.id}`);
    },
    [recordRecentAndOpen],
  );

  const listData = showResults ? results : recentSearches;
  const listEmptyMessage = showResults
    ? error || "No users found."
    : "No recent searches yet.";

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 px-5 py-6 gap-y-6">
        <Input
          placeholder="Search by name or email"
          value={query}
          onChangeText={setQuery}
          icon={<Feather name="search" size={20} color={secondaryTextColor} />}
          inputProps={{ autoFocus: true, returnKeyType: "search" }}
        />

        {!showResults && (
          <View className="flex-row items-center justify-between">
            <Typography.SubHeading2 className="text-primaryText">
              Recent searches
            </Typography.SubHeading2>
            {recentSearches.length > 0 ? (
              <Pressable onPress={() => void clearRecent()} hitSlop={8}>
                <Typography.Body2 className="text-primary">
                  Clear
                </Typography.Body2>
              </Pressable>
            ) : null}
          </View>
        )}

        {showResults && (
          <Typography.Body2 className="text-secondaryText">
            Showing users matching your search
          </Typography.Body2>
        )}

        {!showResults &&
          query.trim().length > 0 &&
          query.trim().length < minQueryLength && (
            <Typography.Body2 className="text-secondaryText">
              Type at least {minQueryLength} characters to search
            </Typography.Body2>
          )}

        {loadingRecent && !showResults ? (
          <View className="py-8 items-center">
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : (
          <FlatList
            className="flex-1"
            data={listData}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-8 gap-y-3"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              loading && showResults ? (
                <View className="py-4 items-center">
                  <ActivityIndicator color={primaryColor} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading || !showResults ? (
                <EmptyState
                  icon={
                    <Ionicons
                      name={showResults ? "search-outline" : "time-outline"}
                      size={28}
                      color={secondaryTextColor}
                    />
                  }
                  message={listEmptyMessage}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <UserSearchRow
                user={item}
                onPress={(user) => void openUserProfile(user)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
};

export default SearchScreen;
