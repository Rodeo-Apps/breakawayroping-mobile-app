import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  AppRefreshControl,
  Avatar,
  EmptyState,
  Input,
  Loader,
  RoundedIconButton,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  T_CHAT_MESSAGE,
  useDirectMessages,
  useGroupMessages,
} from "@/services/supabase/useMessages";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessagesChatScreen = () => {
  const { profile } = useAuth();
  const { type, userId, groupId, title } = useLocalSearchParams<{
    type?: string;
    userId?: string | string[];
    groupId?: string | string[];
    title?: string | string[];
  }>();

  const groupIdStr =
    typeof groupId === "string"
      ? groupId
      : Array.isArray(groupId)
        ? groupId[0]
        : undefined;

  const userIdStr =
    typeof userId === "string"
      ? userId
      : Array.isArray(userId)
        ? userId[0]
        : undefined;

  const listRef = useRef<FlatList<T_CHAT_MESSAGE>>(null);
  const [messageText, setMessageText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const primaryColor = useCSSVariable("--color-primary") as string;
  const insets = useSafeAreaInsets();

  const isGroup = type === "group";

  useTrackScreenFocus("messages_chat", {
    chat_type: isGroup ? "group" : "direct",
    peer_user_id: userIdStr ?? "",
    group_id: groupIdStr ?? "",
  });

  const dm = useDirectMessages(profile?.id, isGroup ? undefined : userIdStr);
  const group = useGroupMessages(profile?.id, isGroup ? groupIdStr : undefined);
  const navigation = useNavigation();

  const titleStr =
    (typeof title === "string" ? title : Array.isArray(title) ? title[0] : "") ??
    "";
  const groupDisplayName = group.groupInfo?.name || titleStr || "Group";

  useFocusEffect(
    useCallback(() => {
      if (isGroup && groupIdStr) {
        void group.loadGroupInfo();
      }
    }, [isGroup, groupIdStr, group.loadGroupInfo]),
  );

  const openGroupDetailsSheet = useCallback(() => {
    if (!groupIdStr) return;
    router.push({
      pathname: "/messages/group-details",
      params: { groupId: groupIdStr, title: groupDisplayName },
    });
  }, [groupIdStr, groupDisplayName]);

  const openDmOptions = useCallback(() => {
    if (!userIdStr) return;
    const peerName =
      dm.peer?.name ||
      dm.peer?.username ||
      dm.peer?.email ||
      titleStr ||
      "User";
    Alert.alert("Conversation", undefined, [
      {
        text: "Report",
        onPress: () =>
          router.push({
            pathname: "/content-moderation",
            params: {
              targetUserId: userIdStr,
              contentType: "user",
              displayTitle: peerName,
            },
          }),
      },
      {
        text: "Block",
        style: "destructive",
        onPress: () =>
          router.push({
            pathname: "/content-moderation",
            params: {
              targetUserId: userIdStr,
              contentType: "user",
              displayTitle: peerName,
            },
          }),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Delete conversation?",
            "All messages in this chat will be removed for both of you.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await dm.deleteConversation();
                    router.replace("/(tabs)/(messages)");
                  } catch {
                    showAlert("Could not delete conversation.", "error");
                  }
                },
              },
            ],
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [userIdStr, dm.peer, dm.deleteConversation, titleStr]);

  useLayoutEffect(() => {
    const headerRight = () => (
      <Pressable
        onPress={() => {
          if (isGroup) openGroupDetailsSheet();
          else openDmOptions();
        }}
        hitSlop={12}
        style={{ marginRight: 4 }}
        accessibilityLabel="Open conversation menu"
      >
        <Ionicons name="ellipsis-horizontal" size={22} color="#000000" />
      </Pressable>
    );

    if (!isGroup) {
      navigation.setOptions({
        headerTitle: titleStr || "Chat",
        headerRight,
      });
      return;
    }
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar
            uri={group.groupInfo?.avatar_url || undefined}
            name={groupDisplayName}
            className="w-8 h-8"
          />
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#000000" }}>
            {groupDisplayName}
          </Text>
        </View>
      ),
      headerRight,
    });
  }, [
    navigation,
    isGroup,
    titleStr,
    group.groupInfo?.avatar_url,
    group.groupInfo?.name,
    groupDisplayName,
    openGroupDetailsSheet,
    openDmOptions,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isGroup) {
        await Promise.all([group.refresh(), group.loadGroupInfo()]);
      } else {
        await dm.refresh();
      }
    } catch {
      showAlert("Could not refresh messages.", "error");
    } finally {
      setRefreshing(false);
    }
  }, [isGroup, group.refresh, group.loadGroupInfo, dm.refresh]);

  const activeMessages = isGroup ? group.messages : dm.messages;
  const activeLoading = isGroup ? group.loading : dm.loading;
  const activeSending = isGroup ? group.sending : dm.sending;
  const peerBlocked = !isGroup && dm.peerBlocked;
  const sendMessage = async () => {
    if (!messageText.trim() || peerBlocked) return;
    try {
      if (isGroup) {
        await group.sendMessage(messageText);
      } else {
        await dm.sendMessage(messageText);
      }
      setMessageText("");
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch {
      showAlert("Failed to send message.", "error");
    }
  };

  if (activeLoading) {
    return <Loader message="Loading chat..." />;
  }

  return (
    <ScreenWrapper withoutTPadding withoutBPadding>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={activeMessages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 py-4 pb-6 gap-y-2"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={28}
                  color={secondaryTextColor}
                />
              }
              message="No messages yet. Start the conversation."
            />
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === profile?.id;
            return (
              <View className={isMine ? "items-end" : "items-start"}>
                {!isMine && isGroup && !!item.sender_name && (
                  <Typography.Caption1 className="text-secondaryText mb-1">
                    {item.sender_name}
                  </Typography.Caption1>
                )}
                <View
                  className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMine ? "bg-primary rounded-br-md" : "bg-background-secondary rounded-bl-md border border-border"}`}
                >
                  <Typography.Body2
                    className={isMine ? "text-white" : "text-primaryText"}
                  >
                    {item.content}
                  </Typography.Body2>
                  <Typography.Caption1
                    className={`mt-1 ${isMine ? "text-white/80" : "text-secondaryText"}`}
                  >
                    {formatTime(item.created_at)}
                  </Typography.Caption1>
                </View>
              </View>
            );
          }}
        />

        {peerBlocked ? (
          <View className="px-5 py-3 border-t border-border bg-background-secondary">
            <Typography.Body2 className="text-secondaryText text-center">
              You blocked this user. Unblock them from the conversation menu to
              message again.
            </Typography.Body2>
          </View>
        ) : (
          <View
            className="px-5 py-3 border-t border-border bg-background flex-row items-end gap-x-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className="flex-1">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChangeText={setMessageText}
                inputProps={{ maxLength: 1000 }}
              />
            </View>
            <RoundedIconButton
              icon={
                <Ionicons
                  name={activeSending ? "hourglass-outline" : "send"}
                  size={20}
                  color="#fff"
                />
              }
              onPress={
                messageText.trim() && !activeSending
                  ? () => void sendMessage()
                  : undefined
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default MessagesChatScreen;
