import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Avatar,
  EmptyState,
  Input,
  Loader,
  ScreenWrapper,
  SheetFormHeader,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  T_MESSAGE_USER,
  useCreateGroupChat,
  useMessageUsers,
} from "@/services/supabase/useMessages";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";

const MessagesNewScreen = () => {
  useTrackScreenFocus("messages_new");
  const { profile } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [isGroupMode, setIsGroupMode] = useState(mode === "group");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;

  const { filteredUsers, loading } = useMessageUsers(profile?.id, searchQuery);
  const { loading: creatingGroup, createGroup } = useCreateGroupChat(profile?.id);

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((item) => item !== userId)
        : [...previous, userId],
    );
  };

  const openDirectChat = (user: T_MESSAGE_USER) => {
    router.replace({
      pathname: "/messages/chat",
      params: {
        type: "dm",
        userId: user.id,
        title: user.name || user.username || user.email || "Chat",
      },
    });
  };

  const createGroupAndOpen = async (memberIds: string[]) => {
    try {
      const group = await createGroup(memberIds);
      router.replace({
        pathname: "/messages/chat",
        params: {
          type: "group",
          groupId: group.id,
          title: group.name || "Group",
        },
      });
    } catch (e: any) {
      showAlert(
        typeof e?.message === "string" ? e.message : "Failed to create group.",
        "error",
      );
    }
  };

  const handleUserPress = (user: T_MESSAGE_USER) => {
    if (isGroupMode) {
      toggleSelectUser(user.id);
      return;
    }
    openDirectChat(user);
  };

  const handleUserLongPress = (user: T_MESSAGE_USER) => {
    if (!isGroupMode) {
      setIsGroupMode(true);
      setSelectedUserIds([user.id]);
      return;
    }
    toggleSelectUser(user.id);
  };

  if (loading) {
    return <Loader message="Loading users..." />;
  }

  return (
    <View className="flex-1 bg-background">
      <SheetFormHeader
        title={isGroupMode ? "Create Group" : "New Message"}
        onClose={() => router.back()}
        primaryAction={
          isGroupMode
            ? {
                label: "Create",
                onPress: () => void createGroupAndOpen(selectedUserIds),
                loading: creatingGroup,
                disabled: selectedUserIds.length === 0,
              }
            : undefined
        }
      />

      <ScreenWrapper withoutTPadding>
        <View className="flex-1 px-5 py-4 gap-y-4">
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Feather name="search" size={20} color={secondaryTextColor} />}
          />

          {isGroupMode ? (
            <View className="flex-row items-center justify-between">
              <Typography.Body2 className="text-secondaryText">
                Long press or tap users to select multiple members.
              </Typography.Body2>
              <Pressable
                className="px-3 py-1.5 rounded-full bg-background-secondary"
                onPress={() => {
                  setIsGroupMode(false);
                  setSelectedUserIds([]);
                }}
              >
                <Typography.Caption1 className="text-secondaryText">
                  Cancel
                </Typography.Caption1>
              </Pressable>
            </View>
          ) : (
            <Typography.Body2 className="text-secondaryText">
              Tap user to chat. Long press to start group selection.
            </Typography.Body2>
          )}

          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-8 gap-y-3"
            ListEmptyComponent={
              <EmptyState
                icon={
                  <Ionicons name="person-outline" size={28} color={secondaryTextColor} />
                }
                message="No users found."
              />
            }
            renderItem={({ item }) => {
              const isSelected = selectedSet.has(item.id);
              return (
                <Pressable
                  className={`rounded-2xl px-4 py-3 flex-row items-center gap-x-3 ${isSelected ? "bg-sky-50 border border-primary" : "bg-background-secondary"}`}
                  onPress={() => handleUserPress(item)}
                  onLongPress={() => handleUserLongPress(item)}
                >
                  <Avatar
                    uri={item.avatar_url || undefined}
                    name={item.name || item.username || item.email || "User"}
                    className="w-12 h-12"
                  />
                  <View className="flex-1">
                    <Typography.SubHeading2 className="text-primaryText">
                      {item.name || item.username || item.email || "Unknown User"}
                    </Typography.SubHeading2>
                    {!!item.username && (
                      <Typography.Body2 className="text-secondaryText">
                        @{item.username}
                      </Typography.Body2>
                    )}
                  </View>

                  {isGroupMode && (
                    <Ionicons
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={isSelected ? "#2563eb" : secondaryTextColor}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </ScreenWrapper>
    </View>
  );
};

export default MessagesNewScreen;

