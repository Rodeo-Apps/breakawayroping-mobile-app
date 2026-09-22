import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Avatar,
  Button,
  Dropdown,
  EmptyState,
  Loader,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useGetEventDetails } from "@/services/supabase/useGetEventDetails";
import { useEventRegistration } from "@/services/supabase/useEventRegistration";
import { useStripePayment } from "@/services/stripe/useStripePayment";
import { showAlert } from "@/utils/toast";
import { useTrackScreenFocus } from "@/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatDate = (value?: string | null) => {
  if (!value) return "Date TBA";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBA";
  return parsed.toLocaleString();
};

const formatMoney = (amount?: number | null, currency = "USD") => {
  if (typeof amount !== "number") return "TBA";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

const getStatusColorClass = (status?: string | null) => {
  switch (status) {
    case "registration_open":
    case "published":
      return "bg-success";
    case "registration_closed":
      return "bg-warning";
    case "in_progress":
      return "bg-primary";
    case "completed":
      return "bg-secondaryText";
    case "cancelled":
      return "bg-danger";
    default:
      return "bg-secondaryText";
  }
};

const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  useTrackScreenFocus("event_detail", { event_id: eventId ?? "" });
  const primaryTextColor = useCSSVariable("--color-primaryText") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [hasAddedToCalendar, setHasAddedToCalendar] = useState(false);

  const insets = useSafeAreaInsets();
  const { event, loading, error } = useGetEventDetails(eventId);
  const {
    horses,
    registrations,
    loading: registrationLoading,
    createRegistration,
    markRegistrationConfirmed,
    refresh,
  } = useEventRegistration(eventId);
  const { loading: stripeLoading, payEventRegistration } = useStripePayment();

  if (loading) {
    return <Loader message="Loading event details..." />;
  }

  if (!event) {
    return (
      <ScreenWrapper>
        <EmptyState
          icon={
            <Ionicons
              name="calendar-outline"
              size={28}
              color={secondaryTextColor}
            />
          }
          message={error || "Event details are unavailable right now."}
        />
      </ScreenWrapper>
    );
  }

  const availableDivisions = event.payout_structure?.divisions || [];
  const registrationDeadline = event.payout_structure?.registration_deadline
    ? new Date(event.payout_structure.registration_deadline)
    : null;
  const isRegistrationOpen =
    !registrationDeadline || registrationDeadline > new Date();
  const isAlreadyRegistered = registrations.length > 0;
  const selectedHorse = horses.find((horse) => horse.id === selectedHorseId);
  const canSubmitRegistration =
    !!selectedHorseId && selectedDivisions.length > 0 && !stripeLoading;
  const selectedRegistrationPrice =
    (typeof event.entry_fee === "number" ? event.entry_fee : 0) *
    selectedDivisions.length;

  const horseOptions = horses.map((horse) => ({
    label: horse.name,
    value: horse.id,
  }));

  const divisionOptions = availableDivisions.map((division) => ({
    label: division,
    value: division,
  }));

  const resetRegistrationForm = () => {
    setSelectedHorseId("");
    setSelectedDivisions([]);
  };

  const handleCompleteRegistration = async () => {
    if (!eventId || !event) return;

    if (!selectedHorse) {
      showAlert("Please select a horse.", "warning");
      return;
    }

    if (selectedDivisions.length === 0) {
      showAlert("Please select at least one division.", "warning");
      return;
    }

    try {
      const registration = await createRegistration({
        eventId,
        horse: selectedHorse,
        divisions: selectedDivisions,
        entryFee: event.entry_fee || 0,
      });

      setShowRegisterModal(false);
      resetRegistrationForm();

      if (registration.total_amount_cents > 0) {
        const paymentResult = await payEventRegistration({
          registrationId: registration.id,
          amountCents: registration.total_amount_cents,
          currency: event.currency || "usd",
        });

        if (paymentResult.cancelled) {
          showAlert("Payment was cancelled.", "warning");
        } else if (!paymentResult.success) {
          showAlert(paymentResult.message || "Payment failed.", "error");
        } else {
          showAlert("Registration confirmed successfully.", "success");
        }
      } else {
        await markRegistrationConfirmed(registration.id);
        showAlert("Registration complete!", "success");
      }

      await refresh();
    } catch (e: any) {
      showAlert(
        typeof e?.message === "string"
          ? e.message
          : "Failed to register for this event.",
        "error",
      );
    }
  };

  const handlePayPendingRegistration = async (
    registrationId: string,
    amountCents: number,
  ) => {
    const result = await payEventRegistration({
      registrationId,
      amountCents,
      currency: event.currency || "usd",
    });

    if (result.cancelled) {
      showAlert("Payment was cancelled.", "warning");
    } else if (!result.success) {
      showAlert(result.message || "Payment failed.", "error");
    } else {
      showAlert("Payment successful. Registration confirmed.", "success");
      await refresh();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-5 py-4 flex-row items-center justify-between bg-background-secondary border-b border-border"
        style={{ paddingTop: Platform.OS === "android" ? insets.top : 0 }}
      >
        <Pressable
          className="bg-background w-10 h-10 rounded-full items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={primaryTextColor} />
        </Pressable>

        <Typography.SubHeading1 className="text-primaryText">
          Event Details
        </Typography.SubHeading1>

        <View className="w-10 h-10" />
      </View>

      <ScreenWrapper withoutTPadding withoutBPadding>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 py-6 pb-8 gap-y-4"
        >
          <View className="bg-background-secondary rounded-2xl border border-border p-4 gap-y-4">
            <View className="flex-row items-start justify-between gap-x-3">
              <Typography.Heading3 className="text-primaryText flex-1">
                {event.event_name || "Untitled Event"}
              </Typography.Heading3>
              <View
                className={`${getStatusColorClass(event.status)} rounded-full px-3 py-1`}
              >
                <Typography.Caption1 className="text-white">
                  {(event.status || "published")
                    .replace("_", " ")
                    .toUpperCase()}
                </Typography.Caption1>
              </View>
            </View>

            {!!event.producer_id && (
              <View className="flex-row items-center gap-x-3">
                <Avatar
                  uri={event.producer?.avatar_url ?? undefined}
                  name={event.producer?.name?.trim() || "Organizer"}
                  className="w-10 h-10"
                />
                <View className="flex-1">
                  <Typography.Caption1 className="text-secondaryText">
                    Posted by
                  </Typography.Caption1>
                  <Typography.Body2 className="text-primaryText">
                    {event.producer?.name?.trim() || "Organizer"}
                  </Typography.Body2>
                </View>
              </View>
            )}

            {!!event.description?.trim() && (
              <View className="gap-y-1">
                <Typography.SubHeading2 className="text-primaryText">
                  About
                </Typography.SubHeading2>
                <Typography.Body2 className="text-secondaryText">
                  {event.description.trim()}
                </Typography.Body2>
              </View>
            )}

            {!!event.organization && (
              <View className="flex-row items-start gap-x-3">
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={secondaryTextColor}
                />
                <Typography.Body2 className="text-secondaryText flex-1">
                  {event.organization}
                </Typography.Body2>
              </View>
            )}

            <View className="flex-row items-start gap-x-3">
              <Ionicons
                name="location-outline"
                size={18}
                color={secondaryTextColor}
              />
              <View className="flex-1 gap-y-0.5">
                <Typography.Body2 className="text-secondaryText">
                  {event.location_name || event.address || "Location TBA"}
                </Typography.Body2>
                {!!event.address && (
                  <Typography.Caption1 className="text-secondaryText">
                    {event.address}
                  </Typography.Caption1>
                )}
              </View>
            </View>

            <View className="flex-row items-start gap-x-3">
              <Ionicons
                name="calendar-outline"
                size={18}
                color={secondaryTextColor}
              />
              <Typography.Body2 className="text-secondaryText flex-1">
                {formatDate(event.start_date)} - {formatDate(event.end_date)}
              </Typography.Body2>
            </View>

            {!!registrationDeadline && (
              <View className="flex-row items-start gap-x-3">
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={secondaryTextColor}
                />
                <Typography.Body2 className="text-secondaryText flex-1">
                  Registration Deadline:{" "}
                  {registrationDeadline.toLocaleDateString()}
                </Typography.Body2>
              </View>
            )}

            <View className="bg-background rounded-xl px-3 py-3 gap-y-2">
              <View className="flex-row items-center justify-between">
                <Typography.Body2 className="text-secondaryText">
                  Entry Fee:
                </Typography.Body2>
                <Typography.SubHeading2 className="text-primaryText">
                  {formatMoney(event.entry_fee, event.currency || "USD")}
                </Typography.SubHeading2>
              </View>
              {(event.prize_pool_cents || 0) > 0 && (
                <View className="flex-row items-center justify-between">
                  <Typography.Body2 className="text-secondaryText">
                    Prize Pool:
                  </Typography.Body2>
                  <Typography.SubHeading2 className="text-primaryText">
                    {formatMoney(
                      typeof event.prize_pool_cents === "number"
                        ? event.prize_pool_cents / 100
                        : null,
                      event.currency || "USD",
                    )}
                  </Typography.SubHeading2>
                </View>
              )}
            </View>

            <View className="gap-y-2">
              <Typography.SubHeading2 className="text-primaryText">
                Divisions Offered
              </Typography.SubHeading2>
              <View className="flex-row flex-wrap gap-2">
                {availableDivisions.length > 0 ? (
                  availableDivisions.map((division) => (
                    <View
                      key={division}
                      className="bg-sky-50 rounded-full px-3 py-1.5"
                    >
                      <Typography.Caption1 className="text-primaryText">
                        {division}
                      </Typography.Caption1>
                    </View>
                  ))
                ) : (
                  <Typography.Body2 className="text-secondaryText">
                    No divisions specified.
                  </Typography.Body2>
                )}
              </View>
            </View>

            {!!event.payout_structure?.rules && (
              <View className="gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  Rules & Information
                </Typography.SubHeading2>
                <Typography.Body2 className="text-secondaryText">
                  {event.payout_structure.rules}
                </Typography.Body2>
              </View>
            )}

            {registrations.length > 0 && (
              <View className="gap-y-3">
                <Typography.SubHeading2 className="text-primaryText">
                  Your Registrations
                </Typography.SubHeading2>
                {registrations.map((registration) => {
                  const divisions = registration.division
                    ?.split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  const isPending =
                    registration.registration_status === "pending_payment";

                  return (
                    <View
                      key={registration.id}
                      className="rounded-xl border border-border bg-background p-3 gap-y-2"
                    >
                      <Typography.SubHeading2 className="text-primaryText">
                        {registration.horse_name}
                      </Typography.SubHeading2>
                      <Typography.Body2 className="text-secondaryText">
                        Divisions: {divisions?.join(", ") || "N/A"}
                      </Typography.Body2>
                      <Typography.Body2 className="text-secondaryText">
                        Status:{" "}
                        {registration.registration_status.replace("_", " ")}
                      </Typography.Body2>
                      {isPending && (
                        <Pressable
                          className="h-10 rounded-full bg-primary items-center justify-center"
                          onPress={() =>
                            handlePayPendingRegistration(
                              registration.id,
                              registration.total_amount_cents || 0,
                            )
                          }
                        >
                          <Typography.SubHeading2 className="text-white">
                            Pay Now (
                            {formatMoney(
                              (registration.total_amount_cents || 0) / 100,
                              event.currency || "USD",
                            )}
                            )
                          </Typography.SubHeading2>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {isRegistrationOpen
            ? !isAlreadyRegistered && (
                <Pressable
                  className="h-12 rounded-full bg-primary items-center justify-center flex-row gap-x-2"
                  onPress={() => setShowRegisterModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Typography.SubHeading2 className="text-white">
                    Register for Event
                  </Typography.SubHeading2>
                </Pressable>
              )
            : !isAlreadyRegistered && (
                <View className="h-12 rounded-full bg-danger/10 border border-danger items-center justify-center flex-row gap-x-2">
                  <Ionicons name="lock-closed" size={18} color="#ef4444" />
                  <Typography.SubHeading2 className="text-danger">
                    Registration Closed
                  </Typography.SubHeading2>
                </View>
              )}

          {!hasAddedToCalendar && (
            <Pressable
              className="h-12 rounded-full bg-success/10 border border-success items-center justify-center flex-row gap-x-2"
              onPress={() => {
                setHasAddedToCalendar(true);
                showAlert("Event added to calendar.", "success");
              }}
            >
              <Ionicons name="calendar-outline" size={18} color="#10b981" />
              <Typography.SubHeading2 className="text-success">
                Add to Google Calendar
              </Typography.SubHeading2>
            </Pressable>
          )}
        </ScrollView>
      </ScreenWrapper>

      <Modal
        visible={showRegisterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setShowRegisterModal(false)}
        >
          <Pressable
            className="bg-background-secondary rounded-t-4xl p-5 gap-y-4"
            onPress={(eventPress) => eventPress.stopPropagation()}
          >
            <Typography.Heading3 className="text-primaryText">
              Register for Event
            </Typography.Heading3>

            <Dropdown
              label="Select Horse"
              placeholder={
                horses.length > 0 ? "Choose your horse" : "No horses found"
              }
              options={horseOptions}
              value={selectedHorseId}
              onChangeValue={(value) => setSelectedHorseId(String(value))}
            />

            <Dropdown
              label="Select Divisions"
              placeholder="Choose divisions"
              options={divisionOptions}
              value={selectedDivisions}
              onChangeValue={(value) => setSelectedDivisions(value as string[])}
              multiSelect
            />

            <View className="rounded-xl bg-background p-3 gap-y-1">
              <Typography.Body2 className="text-secondaryText">
                Total Amount
              </Typography.Body2>
              <Typography.Heading3 className="text-primaryText">
                {formatMoney(
                  selectedRegistrationPrice,
                  event.currency || "USD",
                )}
              </Typography.Heading3>
            </View>

            <View className="flex-row gap-x-3">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setShowRegisterModal(false)}
                />
              </View>
              <View className="flex-1">
                <Button
                  title={
                    stripeLoading || registrationLoading
                      ? "Processing..."
                      : "Complete"
                  }
                  onPress={
                    canSubmitRegistration ? handleCompleteRegistration : null
                  }
                  loading={stripeLoading || registrationLoading}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default EventDetailsScreen;
