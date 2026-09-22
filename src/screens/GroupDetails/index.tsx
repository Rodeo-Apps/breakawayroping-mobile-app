import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Avatar, Button, EmptyState, Input, Loader, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { showAlert } from "@/utils/toast";
import { useGroupDetails } from "@/services/supabase/useGroupDetails";
import { useTrackScreenFocus } from "@/analytics";

const GroupDetailsScreen = () => {
  const { profile } = useAuth();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const groupIdStr =
    typeof groupId === "string"
      ? groupId
      : Array.isArray(groupId)
        ? groupId[0] ?? ""
        : "";
  useTrackScreenFocus("messages_group_details", { group_id: groupIdStr });
  const [searchQuery, setSearchQuery] = useState("");

  const {
    group,
    members,
    availableUsers,
    isAdmin,
    loading,
    saving,
    addMember,
    removeMember,
    makeAdmin,
    removeAdmin,
    updateGroupName,
    updateGroupAvatarFromUri,
    leaveGroup,
    deleteGroup,
  } = useGroupDetails(groupId, profile?.id);

  const [nameDraft, setNameDraft] = useState("");

  const adminCount = members.filter((m) => m.role === "admin").length;
  const isOnlyAdmin = isAdmin && adminCount === 1;

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const normalized = searchQuery.toLowerCase();
    return availableUsers.filter(
      (user) =>
        user.name?.toLowerCase().includes(normalized) ||
        user.username?.toLowerCase().includes(normalized) ||
        user.email?.toLowerCase().includes(normalized),
    );
  }, [availableUsers, searchQuery]);

  useEffect(() => {
    if (group?.name != null) setNameDraft(group.name);
  }, [group?.name]);

  const canSaveGroupName =
    !!group &&
    nameDraft.trim().length > 0 &&
    nameDraft.trim() !== group.name.trim();

  const onPressChangeAvatar = async () => {
    if (!isAdmin) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Please allow photo library access.", "warning");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    try {
      await updateGroupAvatarFromUri(result.assets[0].uri);
      showAlert("Group avatar updated.", "success");
    } catch (e: any) {
      showAlert(
        typeof e?.message === "string" ? e.message : "Failed to update group avatar.",
        "error",
      );
    }
  };

  if (loading) {
    return <Loader message="Loading group details..." />;
  }

  if (!group) {
    return (
      <ScreenWrapper>
        <EmptyState
          icon={<Ionicons name="people-outline" size={28} color={secondaryTextColor} />}
          message="Group not found."
        />
      </ScreenWrapper>
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
        <Typography.SubHeading1 className="text-primaryText">
          Group Details
        </Typography.SubHeading1>
        <View className="w-10 h-10" />
      </View>

      <ScreenWrapper withoutTPadding withoutBPadding>
        <KeyboardAwareScrollView
          className="flex-1"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 py-6 pb-8 gap-y-5"
        >
          <View className="items-center gap-y-2">
            <Pressable disabled={!isAdmin || saving} onPress={onPressChangeAvatar}>
              <Avatar
                uri={group.avatar_url || undefined}
                name={group.name}
                className="w-24 h-24"
              />
              {isAdmin && (
                <View className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background">
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera-outline" size={16} color="#fff" />
                  )}
                </View>
              )}
            </Pressable>
            {isAdmin ? (
              <View className="w-full gap-y-3">
                <Input
                  label="Group name"
                  placeholder="Enter group name"
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  inputProps={{ maxLength: 100 }}
                />
                <Button
                  title="Save name"
                  loading={saving}
                  onPress={
                    canSaveGroupName
                      ? async () => {
                          try {
                            await updateGroupName(nameDraft);
                            showAlert("Group name updated.", "success");
                          } catch (e: any) {
                            showAlert(
                              typeof e?.message === "string"
                                ? e.message
                                : "Failed to update group name.",
                              "error",
                            );
                          }
                        }
                      : undefined
                  }
                />
              </View>
            ) : (
              <Typography.Heading3 className="text-primaryText">
                {group.name}
              </Typography.Heading3>
            )}
            <Typography.Body2 className="text-secondaryText">
              {isAdmin
                ? "You can edit the group name, manage members, and update the avatar."
                : "Only admins can change the group name, members, and avatar."}
            </Typography.Body2>
          </View>

          <View className="gap-y-3">
            <Typography.SubHeading2 className="text-primaryText">
              Members ({members.length})
            </Typography.SubHeading2>
            {members.map((member) => {
              const isCurrentUser = member.user_id === profile?.id;
              const isMemberAdmin = member.role === "admin";

              return (
                <View
                  key={member.id}
                  className="bg-background-secondary rounded-2xl border border-border p-3 flex-row items-center gap-x-3"
                >
                  <Avatar
                    uri={member.profile?.avatar_url || undefined}
                    name={member.profile?.name || member.profile?.email || "Member"}
                    className="w-11 h-11"
                  />

                  <View className="flex-1">
                    <Typography.SubHeading2 className="text-primaryText">
                      {member.profile?.name ||
                        member.profile?.username ||
                        member.profile?.email ||
                        "Unknown User"}
                    </Typography.SubHeading2>
                    <View className="flex-row items-center gap-x-2 mt-0.5 flex-wrap">
                      {isMemberAdmin ? (
                        <View className="px-2 py-0.5 rounded-full bg-primary/15 self-start">
                          <Typography.Caption1 className="text-primary">
                            Admin
                          </Typography.Caption1>
                        </View>
                      ) : (
                        <Typography.Caption1 className="text-secondaryText">
                          Member
                        </Typography.Caption1>
                      )}
                    </View>
                  </View>

                  {isAdmin && !isCurrentUser && (
                    <View className="flex-row items-center gap-x-2">
                      {isMemberAdmin ? (
                        <Pressable
                          className="px-3 py-1.5 rounded-full bg-background border border-border"
                          disabled={saving}
                          onPress={async () => {
                            try {
                              await removeAdmin(member.user_id);
                              showAlert("Admin access revoked.", "success");
                            } catch (e: any) {
                              showAlert(
                                typeof e?.message === "string"
                                  ? e.message
                                  : "Failed to update member role.",
                                "error",
                              );
                            }
                          }}
                        >
                          <Typography.Caption1 className="text-primaryText">
                            Revoke admin
                          </Typography.Caption1>
                        </Pressable>
                      ) : (
                        <Pressable
                          className="px-3 py-1.5 rounded-full bg-primary/10"
                          disabled={saving}
                          onPress={async () => {
                            try {
                              await makeAdmin(member.user_id);
                              showAlert("Member promoted to admin.", "success");
                            } catch (e: any) {
                              showAlert(
                                typeof e?.message === "string"
                                  ? e.message
                                  : "Failed to update member role.",
                                "error",
                              );
                            }
                          }}
                        >
                          <Typography.Caption1 className="text-primary">
                            Make admin
                          </Typography.Caption1>
                        </Pressable>
                      )}
                      <Pressable
                        className="px-3 py-1.5 rounded-full bg-danger/10"
                        disabled={saving}
                        onPress={async () => {
                          try {
                            await removeMember(member.user_id);
                            showAlert("Member removed.", "success");
                          } catch (e: any) {
                            showAlert(
                              typeof e?.message === "string"
                                ? e.message
                                : "Failed to remove member.",
                              "error",
                            );
                          }
                        }}
                      >
                        <Typography.Caption1 className="text-danger">
                          Remove
                        </Typography.Caption1>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {isAdmin && (
            <View className="gap-y-3">
              <Typography.SubHeading2 className="text-primaryText">
                Add Members
              </Typography.SubHeading2>
              <Input
                placeholder="Search users to add..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                icon={<Feather name="search" size={20} color={secondaryTextColor} />}
              />

              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View className="h-2" />}
                ListEmptyComponent={
                  <EmptyState
                    icon={
                      <Ionicons
                        name="person-add-outline"
                        size={24}
                        color={secondaryTextColor}
                      />
                    }
                    message="No users available to add."
                  />
                }
                renderItem={({ item }) => (
                  <View className="bg-background-secondary rounded-2xl border border-border p-3 flex-row items-center gap-x-3">
                    <Avatar
                      uri={item.avatar_url || undefined}
                      name={item.name || item.email || "User"}
                      className="w-10 h-10"
                    />
                    <View className="flex-1">
                      <Typography.SubHeading2 className="text-primaryText">
                        {item.name || item.username || item.email || "Unknown User"}
                      </Typography.SubHeading2>
                      {!!item.username && (
                        <Typography.Caption1 className="text-secondaryText">
                          @{item.username}
                        </Typography.Caption1>
                      )}
                    </View>
                    <Pressable
                      className="px-3 py-1.5 rounded-full bg-success/10"
                      disabled={saving}
                      onPress={async () => {
                        try {
                          await addMember(item.id);
                          showAlert("Member added.", "success");
                        } catch (e: any) {
                          showAlert(
                            typeof e?.message === "string"
                              ? e.message
                              : "Failed to add member.",
                            "error",
                          );
                        }
                      }}
                    >
                      <Typography.Caption1 className="text-success">
                        Add
                      </Typography.Caption1>
                    </Pressable>
                  </View>
                )}
              />
            </View>
          )}

          <View className="gap-y-3 pt-6 border-t border-border mt-2">
            <Typography.SubHeading2 className="text-primaryText">
              Membership
            </Typography.SubHeading2>
            <Pressable
              className="bg-background-secondary rounded-2xl border border-border px-4 py-3"
              disabled={saving}
              onPress={() =>
                Alert.alert(
                  "Leave group?",
                  isOnlyAdmin
                    ? "You're the only admin. After you leave, remaining members may need to coordinate a new admin."
                    : "You will stop receiving messages from this group.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Leave",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await leaveGroup();
                          router.replace("/(tabs)/(messages)");
                          showAlert("You left the group.", "success");
                        } catch (e: any) {
                          showAlert(
                            typeof e?.message === "string"
                              ? e.message
                              : "Could not leave group.",
                            "error",
                          );
                        }
                      },
                    },
                  ],
                )
              }
            >
              <Typography.SubHeading2 className="text-primaryText text-center">
                Remove me from group
              </Typography.SubHeading2>
            </Pressable>
          </View>

          <View className="gap-y-3 pt-6 border-t border-border mt-2">
            <Typography.SubHeading2 className="text-primaryText">
              Safety
            </Typography.SubHeading2>
            <Pressable
              className="bg-background-secondary rounded-2xl border border-border px-4 py-3 flex-row items-center justify-between"
              onPress={() =>
                router.push({
                  pathname: "/messages/report",
                  params: {
                    kind: "group",
                    targetId: group.id,
                    title: group.name,
                  },
                })
              }
            >
              <Typography.SubHeading2 className="text-primaryText">
                Report group
              </Typography.SubHeading2>
              <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
            </Pressable>
            {isAdmin && (
              <Pressable
                className="bg-danger/10 rounded-2xl border border-danger/30 px-4 py-3"
                disabled={saving}
                onPress={() =>
                  Alert.alert(
                    "Delete group?",
                    "This removes the group and its chat history for everyone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete group",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteGroup();
                            router.replace("/(tabs)/(messages)");
                          } catch (e: any) {
                            showAlert(
                              typeof e?.message === "string"
                                ? e.message
                                : "Could not delete group.",
                              "error",
                            );
                          }
                        },
                      },
                    ],
                  )
                }
              >
                <Typography.SubHeading2 className="text-danger text-center">
                  Delete group
                </Typography.SubHeading2>
              </Pressable>
            )}
          </View>
        </KeyboardAwareScrollView>
      </ScreenWrapper>
    </View>
  );
};

export default GroupDetailsScreen;

