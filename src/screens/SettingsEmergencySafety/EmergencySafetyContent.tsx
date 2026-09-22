import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  Input,
  SheetFormHeader,
  TopTabs,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  useEmergencySafety,
  type T_NEW_EMERGENCY_CONTACT,
} from "@/services/supabase/useEmergencySafety";
import type { T_EMERGENCY_ALERT_ROW } from "@/services/supabase/emergencyTypes";
import { useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabKey = "contacts" | "alerts" | "resources";

const RESOURCES: {
  name: string;
  phone: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: "911 Emergency", phone: "911", icon: "medkit" },
  { name: "Poison Control", phone: "1-800-222-1222", icon: "flask" },
  { name: "Suicide Prevention", phone: "988", icon: "heart" },
  { name: "Animal Emergency", phone: "1-888-426-4435", icon: "paw" },
];

function alertStatusColor(status: string) {
  switch (status) {
    case "active":
      return "#ef4444";
    case "responded":
      return "#f59e0b";
    case "resolved":
      return "#10b981";
    default:
      return "#6b7280";
  }
}

export default function EmergencySafetyContent() {
  useTrackScreenFocus("emergency_safety");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const { profile } = useAuth();
  const userId = profile?.id;

  const {
    contacts,
    alerts,
    loading,
    refresh,
    addContact,
    deleteContact,
    sendPanicAlert,
  } = useEmergencySafety(userId);

  const [tab, setTab] = useState<TabKey>("contacts");
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<T_NEW_EMERGENCY_CONTACT>({
    contact_name: "",
    relationship: "",
    phone_number: "",
    email: "",
    is_primary: false,
  });

  useFocusEffect(
    useCallback(() => {
      if (userId) void refresh();
    }, [userId, refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const submitContact = useCallback(async () => {
    if (!form.contact_name.trim() || !form.phone_number.trim()) {
      Alert.alert("Missing", "Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      await addContact(form);
      setAddOpen(false);
      setForm({
        contact_name: "",
        relationship: "",
        phone_number: "",
        email: "",
        is_primary: false,
      });
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not add contact",
      );
    } finally {
      setSaving(false);
    }
  }, [form, addContact]);

  const onPanic = useCallback(async () => {
    setPanicOpen(false);
    setSaving(true);
    try {
      await sendPanicAlert();
      Alert.alert(
        "Emergency alert sent",
        "Your alert was recorded. If you are in immediate danger, call 911.",
      );
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to send alert",
      );
    } finally {
      setSaving(false);
    }
  }, [sendPanicAlert]);

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete contact", "Remove this emergency contact?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteContact(id);
            } catch (e: unknown) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to delete",
              );
            }
          },
        },
      ]);
    },
    [deleteContact],
  );

  if (loading && contacts.length === 0 && alerts.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 pt-4 pb-3 items-center border-b border-border bg-background-secondary">
        <Pressable
          onPress={() => setPanicOpen(true)}
          disabled={saving}
          className="w-36 h-36 rounded-full bg-danger items-center justify-center active:opacity-90 shadow-md"
        >
          <Ionicons name="warning" size={44} color="#fff" />
          <Typography.Body2 className="text-white font-poppins-bold mt-1">
            EMERGENCY
          </Typography.Body2>
          <Typography.Caption1 className="text-white/90 mt-0.5">
            Tap to activate
          </Typography.Caption1>
        </Pressable>
        <Typography.Caption1 className="text-secondaryText text-center mt-3 px-4">
          Sends an emergency alert record. Add contacts below and call 911 if
          needed.
        </Typography.Caption1>
      </View>

      <View className="px-5 py-3 border-b border-border bg-background-secondary">
        <TopTabs
          options={[
            { label: "Contacts", value: "contacts" },
            { label: "History", value: "alerts" },
            { label: "Resources", value: "resources" },
          ]}
          selected={tab}
          onChange={(v) => setTab(v as TabKey)}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === "contacts" ? (
          <View className="gap-y-4">
            <Button title="Add emergency contact" onPress={() => setAddOpen(true)} />
            {contacts.length === 0 ? (
              <View className="items-center py-10">
                <Ionicons name="people-outline" size={56} color="#d1d5db" />
                <Typography.Body2 className="text-secondaryText mt-3 text-center">
                  No emergency contacts yet
                </Typography.Body2>
              </View>
            ) : (
              contacts.map((c) => (
                <View
                  key={c.id}
                  className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-2"
                >
                  <View className="flex-row justify-between items-start gap-x-2">
                    <View className="flex-1 gap-y-1">
                      <View className="flex-row items-center gap-x-2 flex-wrap">
                        <Typography.Body2 className="text-primaryText font-poppins-semibold">
                          {c.contact_name}
                        </Typography.Body2>
                        {c.is_primary ? (
                          <View className="bg-danger/15 px-2 py-0.5 rounded-md">
                            <Typography.Caption1 className="text-danger font-poppins-bold">
                              PRIMARY
                            </Typography.Caption1>
                          </View>
                        ) : null}
                      </View>
                      {c.relationship ? (
                        <Typography.Caption1 className="text-secondaryText">
                          {c.relationship}
                        </Typography.Caption1>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => confirmDelete(c.id)}
                      hitSlop={8}
                      accessibilityLabel="Delete contact"
                    >
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${c.phone_number}`)}
                    className="flex-row items-center gap-x-2 self-start bg-primary/10 px-3 py-2 rounded-xl active:opacity-80"
                  >
                    <Ionicons name="call" size={18} color={primaryColor} />
                    <Typography.Body2 className="text-primary font-poppins-semibold">
                      {c.phone_number}
                    </Typography.Body2>
                  </Pressable>
                  {c.email ? (
                    <Typography.Caption1 className="text-secondaryText">
                      {c.email}
                    </Typography.Caption1>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : tab === "alerts" ? (
          <View className="gap-y-4">
            {alerts.length === 0 ? (
              <View className="items-center py-10">
                <Ionicons name="notifications-outline" size={56} color="#d1d5db" />
                <Typography.Body2 className="text-secondaryText mt-3">
                  No emergency alerts yet
                </Typography.Body2>
              </View>
            ) : (
              alerts.map((a: T_EMERGENCY_ALERT_ROW) => (
                <View
                  key={a.id}
                  className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-2"
                >
                  <View className="flex-row items-center justify-between gap-x-2">
                    <Typography.Caption1 className="text-primaryText font-poppins-bold uppercase">
                      {a.alert_type.replace(/_/g, " ")}
                    </Typography.Caption1>
                    <View
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${alertStatusColor(a.alert_status)}22`,
                      }}
                    >
                      <Text
                        className="font-poppins-bold text-xs"
                        style={{ color: alertStatusColor(a.alert_status) }}
                      >
                        {a.alert_status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Typography.Caption1 className="text-secondaryText">
                    {new Date(a.created_at).toLocaleString()}
                  </Typography.Caption1>
                  {a.user_message ? (
                    <Typography.Body2 className="text-primaryText">
                      {a.user_message}
                    </Typography.Body2>
                  ) : null}
                  {a.location_address ? (
                    <View className="flex-row items-center gap-x-2">
                      <Ionicons name="location" size={16} color="#6b7280" />
                      <Typography.Caption1 className="text-secondaryText flex-1">
                        {a.location_address}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="gap-y-6">
            <Typography.SubHeading2 className="text-primaryText">
              Emergency resources
            </Typography.SubHeading2>
            {RESOURCES.map((r) => (
              <Pressable
                key={r.phone}
                onPress={() => Linking.openURL(`tel:${r.phone}`)}
                className="flex-row items-center gap-x-3 bg-background-secondary border border-border rounded-2xl p-4 active:opacity-90"
              >
                <View className="w-12 h-12 rounded-full bg-danger/10 items-center justify-center">
                  <Ionicons name={r.icon} size={22} color="#ef4444" />
                </View>
                <View className="flex-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold">
                    {r.name}
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    {r.phone}
                  </Typography.Caption1>
                </View>
                <Ionicons name="call" size={22} color={primaryColor} />
              </Pressable>
            ))}
            <View className="gap-y-2">
              <Typography.SubHeading2 className="text-primaryText">
                Safety tips
              </Typography.SubHeading2>
              {[
                "Wear proper safety equipment when riding.",
                "Keep emergency contacts up to date.",
                "Share your location when riding alone.",
                "Keep a first aid kit accessible.",
              ].map((t) => (
                <View key={t} className="flex-row gap-x-2 items-start">
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Typography.Body2 className="text-secondaryText flex-1">{t}</Typography.Body2>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={addOpen}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        onRequestClose={() => setAddOpen(false)}
      >
        <View className="flex-1 bg-background">
          <SheetFormHeader
            title="Add emergency contact"
            onClose={() => setAddOpen(false)}
          />
          <KeyboardAwareScrollView
            className="px-5 py-6"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View className="gap-y-6">
              <Input
                label="Contact name *"
                placeholder="Name"
                value={form.contact_name}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, contact_name: text }))
                }
              />
              <Input
                label="Relationship"
                placeholder="e.g. Spouse"
                value={form.relationship}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, relationship: text }))
                }
              />
              <Input
                label="Phone *"
                placeholder="Phone number"
                value={form.phone_number}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, phone_number: text }))
                }
                inputProps={{ keyboardType: "phone-pad" }}
              />
              <Input
                label="Email"
                placeholder="Optional"
                value={form.email}
                onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
                inputProps={{
                  keyboardType: "email-address",
                  autoCapitalize: "none",
                }}
              />
              <Pressable
                onPress={() =>
                  setForm((f) => ({ ...f, is_primary: !f.is_primary }))
                }
                className="flex-row items-center gap-x-3"
              >
                <Ionicons
                  name={form.is_primary ? "checkbox" : "square-outline"}
                  size={24}
                  color="#ef4444"
                />
                <Typography.Body2 className="text-primaryText">
                  Set as primary contact
                </Typography.Body2>
              </Pressable>
              <Button
                title="Save contact"
                loading={saving}
                onPress={() => void submitContact()}
              />
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      <Modal visible={panicOpen} animationType="fade" transparent>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-background rounded-3xl p-6 w-full max-w-md gap-y-4 border border-border">
            <View className="items-center">
              <Ionicons name="warning" size={56} color="#ef4444" />
            </View>
            <Typography.Heading3 className="text-primaryText text-center">
              Activate emergency alert?
            </Typography.Heading3>
            <Typography.Body2 className="text-secondaryText text-center">
              This records an emergency alert on your account. For life-threatening
              emergencies, call 911.
            </Typography.Body2>
            <View className="flex-row gap-x-3 mt-2">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="outlined"
                  onPress={() => setPanicOpen(false)}
                />
              </View>
              <View className="flex-1">
                <Button title="Send alert" onPress={() => void onPanic()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
