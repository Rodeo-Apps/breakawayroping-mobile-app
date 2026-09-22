import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AlertButton,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";
import { Typography } from "@/utils/typography";

export interface EmergencyContact {
  id: string;
  contact_name: string;
  phone_number: string;
  is_vet: boolean;
  alert_type: "horse" | "personal" | "both";
}

interface Horse {
  id: string;
  name: string;
}

type EmergencyAlertContentProps = {
  /** Hides the large title row when the parent screen already shows a nav title (e.g. Settings → Emergency). */
  compactHeader?: boolean;
};

const EmergencyAlertContent = ({
  compactHeader = false,
}: EmergencyAlertContentProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (user) {
      void loadData();
      void getLocation();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [contactsRes, horsesRes, profileRes] = await Promise.all([
        supabase
          .from("emergency_contacts")
          .select("id, contact_name, phone_number, is_vet, alert_type")
          .eq("user_id", user?.id),
        supabase
          .from("horses")
          .select("id, name")
          .eq("user_id", user?.id),
        supabase.from("profiles").select("name").eq("id", user?.id).single(),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data);
      if (horsesRes.data) setHorses(horsesRes.data);
      if (profileRes.data) setUserName(profileRes.data.name || "User");
    } catch (error: unknown) {
      console.error("Error loading data:", error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is needed to share your location in emergencies.",
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const getGoogleMapsLink = () => {
    if (!location) return "Location unavailable";
    const { latitude, longitude } = location.coords;
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  };

  const getHorseSelectionAlert = (
    onSelect: (horseName: string | null) => void,
  ) => {
    if (horses.length === 0) {
      onSelect(null);
      return;
    }

    const buttons = horses.map((horse) => ({
      text: horse.name,
      onPress: () => onSelect(horse.name),
    }));

    buttons.push({
      text: "General Emergency",
      onPress: () => onSelect(null),
    });

    buttons.push({
      text: "Cancel",
      onPress: () => {},
    });

    Alert.alert("Select Horse", "Which horse needs help?", buttons, {
      cancelable: true,
    });
  };

  const sendEmergencyAlert = async (type: "horse" | "personal") => {
    if (contacts.length === 0) {
      Alert.alert("No Contacts", "Please add emergency contacts first.", [
        { text: "OK" },
      ]);
      return;
    }

    setLoading(true);

    try {
      await getLocation();

      const relevantContacts = contacts.filter(
        (c) => c.alert_type === type || c.alert_type === "both",
      );

      if (relevantContacts.length === 0) {
        Alert.alert(
          "No Contacts",
          `No contacts are set to receive ${type} emergency alerts. Please update your emergency contacts.`,
        );
        setLoading(false);
        return;
      }

      if (type === "horse") {
        getHorseSelectionAlert((horseName) => {
          sendAlertMessages(type, relevantContacts, horseName);
        });
      } else {
        sendAlertMessages(type, relevantContacts, null);
      }
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Something went wrong";
      Alert.alert("Error", msg);
      setLoading(false);
    }
  };

  const sendAlertMessages = (
    type: "horse" | "personal",
    relevantContacts: EmergencyContact[],
    horseName: string | null,
  ) => {
    const locationLink = getGoogleMapsLink();
    const horseText = horseName ? ` ${horseName}` : "";
    const emergencyTypeText =
      type === "horse" ? `HORSE EMERGENCY!${horseText}` : "PERSONAL EMERGENCY!";

    const message = `EMERGENCY from ${userName}! ${emergencyTypeText} needs immediate help. My location: ${locationLink}. Please call me immediately!`;

    const phoneNumbers = relevantContacts.map((c) => c.phone_number).join(",");

    const options: {
      text: string;
      onPress?: () => void;
      style?: "cancel";
    }[] = [
      {
        text: "Send SMS to All",
        onPress: () => sendSMS(phoneNumbers, message),
      },
    ];

    relevantContacts.forEach((contact) => {
      options.push({
        text: `Call ${contact.contact_name}`,
        onPress: () => makePhoneCall(contact.phone_number),
      });
    });

    options.push({
      text: "Cancel",
      style: "cancel",
    });

    Alert.alert(
      "Choose Action",
      `Alert ${relevantContacts.length} contact(s)`,
      options,
      { cancelable: true },
    );

    setLoading(false);
  };

  const sendSMS = async (phoneNumbers: string, message: string) => {
    try {
      const separator = Platform.OS === "ios" ? "&" : "?";
      const url = `sms:${phoneNumbers}${separator}body=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to open SMS app");
      }
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to open SMS";
      Alert.alert("Error", msg);
    }
  };

  const makePhoneCall = async (phoneNumber: string) => {
    try {
      const url = `tel:${phoneNumber}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to make phone call");
      }
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to make call";
      Alert.alert("Error", msg);
    }
  };

  const callVet = () => {
    const vets = contacts.filter((c) => c.is_vet);

    if (vets.length === 0) {
      Alert.alert(
        "No Vet Contacts",
        "Please add a veterinary contact in your emergency contacts.",
      );
      return;
    }

    if (vets.length === 1) {
      void makePhoneCall(vets[0].phone_number);
      return;
    }

    const buttons: AlertButton[] = vets.map((vet) => ({
      text: vet.contact_name,
      onPress: () => void makePhoneCall(vet.phone_number),
    }));

    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Call Veterinarian", "Choose a vet to call", buttons);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-8"
      keyboardShouldPersistTaps="handled"
    >
      {!compactHeader ? (
        <View className="bg-card border-b border-border px-5 py-5">
          <Typography.Heading2 className="text-primaryText">
            Emergency Alert
          </Typography.Heading2>
          <Typography.Body2 className="text-secondaryText mt-1">
            Quick access to emergency contacts
          </Typography.Body2>
        </View>
      ) : (
        <View className="flex-row items-center gap-3 px-5 pt-4 pb-2">
          <Ionicons name="warning" size={26} color="#dc2626" />
          <View className="flex-1">
            <Typography.Body2 className="text-secondaryText">
              Quick access to emergency contacts and location sharing.
            </Typography.Body2>
          </View>
        </View>
      )}

      <View className="px-4 pt-4 gap-y-5">
        <View className="rounded-xl border border-border bg-primary/10 p-4">
          <Typography.Body1 className="text-primary font-semibold">
            {contacts.length} emergency contact(s) configured
          </Typography.Body1>
          <Typography.Body2 className="text-primary mt-1">
            {location
              ? "Location services enabled"
              : "Location unavailable — grant permission when prompted"}
          </Typography.Body2>
        </View>

        <View className="gap-y-4">
          <Pressable
            className="min-h-[160px] rounded-2xl bg-[#d32f2f] items-center justify-center px-6 py-8 shadow-lg active:opacity-90"
            onPress={() => sendEmergencyAlert("horse")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <Typography.Heading1 className="text-white text-5xl mb-3">
                  🐴
                </Typography.Heading1>
                <Typography.Heading2 className="text-white text-center">
                  HORSE EMERGENCY
                </Typography.Heading2>
                <Typography.Body2 className="text-red-100 text-center mt-2">
                  Alert contacts about horse emergency
                </Typography.Body2>
              </>
            )}
          </Pressable>

          <Pressable
            className="min-h-[160px] rounded-2xl bg-[#c62828] items-center justify-center px-6 py-8 shadow-lg active:opacity-90"
            onPress={() => sendEmergencyAlert("personal")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <Typography.Heading1 className="text-white text-5xl mb-3">
                  🚨
                </Typography.Heading1>
                <Typography.Heading2 className="text-white text-center">
                  I NEED HELP
                </Typography.Heading2>
                <Typography.Body2 className="text-red-100 text-center mt-2">
                  Alert contacts about personal emergency
                </Typography.Body2>
              </>
            )}
          </Pressable>
        </View>

        <View>
          <Typography.Heading3 className="text-primaryText mb-3">
            Quick Actions
          </Typography.Heading3>
          <Pressable
            className="bg-card border border-border rounded-xl py-4 px-4 mb-3 active:opacity-80"
            onPress={callVet}
          >
            <Typography.Body1 className="text-primaryText text-center font-semibold">
              Call Veterinarian
            </Typography.Body1>
          </Pressable>
          <Pressable
            className="bg-card border border-border rounded-xl py-4 px-4 active:opacity-80"
            onPress={() => makePhoneCall("911")}
          >
            <Typography.Body1 className="text-primaryText text-center font-semibold">
              Call 911
            </Typography.Body1>
          </Pressable>
        </View>

        <View className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4">
          <Typography.Body1 className="text-amber-900 dark:text-amber-100 font-bold mb-2">
            How it works
          </Typography.Body1>
          <Typography.Body2 className="text-amber-900/90 dark:text-amber-100/90 leading-5">
            • Emergency buttons alert your configured contacts{"\n"}• Your
            current GPS location is shared when available{"\n"}• Send SMS to
            all or call individual contacts{"\n"}• Vet calls your veterinary
            contacts directly
          </Typography.Body2>
        </View>

        <View className="rounded-xl border border-border bg-muted/50 p-4">
          <Typography.Body1 className="text-primaryText font-semibold mb-1">
            Current location
          </Typography.Body1>
          {location ? (
            <Typography.Body2
              className="text-secondaryText font-mono text-xs"
              textProps={{ selectable: true }}
            >
              {location.coords.latitude.toFixed(6)},{" "}
              {location.coords.longitude.toFixed(6)}
            </Typography.Body2>
          ) : (
            <Typography.Body2 className="text-amber-700 dark:text-amber-300">
              Acquiring location…
            </Typography.Body2>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default EmergencyAlertContent;
