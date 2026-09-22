import React, { useCallback, useLayoutEffect, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  Avatar,
  EmptyState,
  FloatingRoundedIconButton,
  Input,
  Loader,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  T_CONVERSATION,
  conversationSelectionKey,
  deleteAllMessagesWithPeer,
  useMessagesConversations,
} from "@/services/supabase/useMessages";
import { showAlert } from "@/utils/toast";
import {
  MessagesTabHeaderLeft,
  MessagesTabHeaderRight,
} from "@/screens/TabsMessages/MessagesTabHeaderChrome";
import { useTrackScreenFocus } from "@/analytics";

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

const TabsMessagesScreen = () => {
  useTrackScreenFocus("tabs_messages");
  const { profile } = useAuth();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;
  const dangerColor = useCSSVariable("--color-danger") as string;

  const { filteredConversations, loading, refresh } = useMessagesConversations(
    profile?.id,
    searchQuery,
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh({ showLoader: false });
      return () => {
        setSelectionMode(false);
        setSelectedKeys(new Set());
      };
    }, [refresh]),
  );

  const selectedDmKeys = Array.from(selectedKeys).filter((k) => k.startsWith("dm:"));
  const selectedGroupKeys = Array.from(selectedKeys).filter((k) =>
    k.startsWith("group:"),
  );
  const hasDeletableSelection = selectedDmKeys.length > 0;

  const onDeletePress = useCallback(() => {
    if (!profile?.id) return;
    if (!hasDeletableSelection) {
      Alert.alert(
        "Cannot delete",
        "Group chats can't be deleted while you're still a member. Leave the group first.",
      );
      return;
    }

    const dmCount = selectedDmKeys.length;
    const skippedGroups = selectedGroupKeys.length;

    Alert.alert(
      "Delete conversations?",
      skippedGroups > 0
        ? `This will remove ${dmCount} direct chat(s) for you. ${skippedGroups} group chat(s) will be skipped.`
        : `This will remove ${dmCount} direct chat(s) for you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              for (const key of selectedDmKeys) {
                const peerId = key.slice("dm:".length);
                await deleteAllMessagesWithPeer(profile.id, peerId);
              }
              await refresh({ showLoader: false });
              exitSelectionMode();
              if (skippedGroups > 0) {
                showAlert(
                  `${skippedGroups} group chat(s) were not deleted — you’re still a member.`,
                  "warning",
                );
              } else {
                showAlert("Conversations deleted.", "success");
              }
            } catch (e: any) {
              showAlert(
                typeof e?.message === "string"
                  ? e.message
                  : "Could not delete conversations.",
                "error",
              );
            }
          },
        },
      ],
    );
  }, [
    profile?.id,
    hasDeletableSelection,
    selectedDmKeys,
    selectedGroupKeys,
    refresh,
    exitSelectionMode,
  ]);

  useLayoutEffect(() => {
    if (!selectionMode) {
      navigation.setOptions({
        headerTitle: "Breakaway Connect",
        headerTitleAlign: "center",
        headerLeft: () => <MessagesTabHeaderLeft />,
        headerRight: () => <MessagesTabHeaderRight />,
      });
      return;
    }

    navigation.setOptions({
      headerTitle:
        selectedKeys.size === 0 ? "Select chats" : `${selectedKeys.size} selected`,
      headerTitleAlign: "center",
      headerLeft: () => (
        <Pressable
          onPress={exitSelectionMode}
          className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center"
          accessibilityLabel="Cancel selection"
        >
          <Feather name="x" size={22} color={primaryTextColor} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={onDeletePress}
          className="w-10 h-10 rounded-full bg-background-secondary items-center justify-center"
          accessibilityLabel="Delete selected conversations"
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={hasDeletableSelection ? dangerColor : secondaryTextColor}
          />
        </Pressable>
      ),
    });
  }, [
    navigation,
    selectionMode,
    selectedKeys.size,
    exitSelectionMode,
    onDeletePress,
    hasDeletableSelection,
    primaryTextColor,
    dangerColor,
    secondaryTextColor,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openConversation = (conversation: T_CONVERSATION) => {
    if (conversation.type === "dm") {
      router.push({
        pathname: "/messages/chat",
        params: {
          type: "dm",
          userId: conversation.other_user_id || conversation.id,
          title: conversation.name,
        },
      });
      return;
    }

    router.push({
      pathname: "/messages/chat",
      params: {
        type: "group",
        groupId: conversation.id,
        title: conversation.name,
      },
    });
  };

  const beginSelection = (item: T_CONVERSATION) => {
    setSelectionMode(true);
    setSelectedKeys(new Set([conversationSelectionKey(item)]));
  };

  const toggleSelected = (item: T_CONVERSATION) => {
    const key = conversationSelectionKey(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onRowPress = (item: T_CONVERSATION) => {
    if (selectionMode) {
      toggleSelected(item);
      return;
    }
    openConversation(item);
  };

  if (loading) {
    return <Loader message="Loading conversations..." />;
  }

  return (
    <View className="flex-1 px-5 py-6">
      <Input
        placeholder="Search conversations..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        icon={<Feather name="search" size={20} color={secondaryTextColor} />}
        inputProps={{ editable: !selectionMode }}
      />

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => conversationSelectionKey(item)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
        contentContainerClassName="py-4 pb-28 gap-y-3"
        ListEmptyComponent={
          <EmptyState
            icon={
              <Ionicons
                name="chatbubbles-outline"
                size={28}
                color={secondaryTextColor}
              />
            }
            message="No conversations yet."
          />
        }
        renderItem={({ item }) => {
          const key = conversationSelectionKey(item);
          const selected = selectedKeys.has(key);
          return (
            <Pressable
              className={`bg-background-secondary rounded-2xl px-4 py-3 flex-row items-center gap-x-3 ${selected ? "border-2 border-primary" : "border border-transparent"}`}
              onPress={() => onRowPress(item)}
              onLongPress={() => beginSelection(item)}
              delayLongPress={380}
            >
              {selectionMode && (
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selected ? "border-primary bg-primary" : "border-border"}`}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : null}
                </View>
              )}
              <View className="relative">
                <Avatar
                  uri={item.avatar_url || undefined}
                  name={item.name}
                  className="w-12 h-12"
                />
                {!selectionMode && item.unread_count > 0 && (
                  <View className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-danger items-center justify-center px-1">
                    <Typography.Caption1 className="text-white">
                      {item.unread_count > 99 ? "99+" : item.unread_count}
                    </Typography.Caption1>
                  </View>
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between gap-x-3">
                  <Typography.SubHeading2 className="text-primaryText flex-1">
                    {item.name}
                  </Typography.SubHeading2>
                  <Typography.Caption1 className="text-secondaryText">
                    {formatMessageTime(item.last_message_time)}
                  </Typography.Caption1>
                </View>
                <Typography.Body2
                  className="text-secondaryText"
                  textProps={{ numberOfLines: 1 }}
                >
                  {item.last_message}
                </Typography.Body2>
              </View>
            </Pressable>
          );
        }}
      />

      {!selectionMode && (
        <FloatingRoundedIconButton
          icon={<Feather name="plus" size={22} color="#fff" />}
          onPress={() => router.push("/messages/new")}
          accessibilityLabel="Start new message"
        />
      )}
    </View>
  );
};

export default TabsMessagesScreen;
