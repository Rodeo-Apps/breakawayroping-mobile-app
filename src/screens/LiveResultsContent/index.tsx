import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppRefreshControl } from "@/components";
import MyDrawPosition from "@/components/MyDrawPosition";
import { supabase } from "@/lib/supabase";
import { Typography } from "@/utils/typography";

export interface LiveEventParticipant {
  id: string;
  rider_name: string;
  horse_name: string;
  bib_number: string;
  division: string;
  time_division: string | null;
  run_time: number;
  position: number;
  penalties: number;
  status: string;
  has_run: boolean;
}

export interface LiveEventWithScores {
  id: string;
  event_name: string;
  start_date: string;
  is_live: boolean;
  participants: LiveEventParticipant[];
}

type LiveResultsContentProps = {
  /** Hides in-screen back + title when the parent navigator already shows a header (e.g. Settings → Live Results). */
  compactHeader?: boolean;
};

const DIVISIONS = ["1D", "2D", "3D", "4D", "5D"] as const;

const LiveBadge = () => (
  <View className="flex-row items-center bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-xl">
    <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
    <Typography.Caption1 className="text-red-600 font-bold">LIVE</Typography.Caption1>
  </View>
);

const LiveResultsContent = ({ compactHeader = false }: LiveResultsContentProps) => {
  const [liveEvents, setLiveEvents] = useState<LiveEventWithScores[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null);

  useEffect(() => {
    void loadLiveEvents();
    const subscription = supabase
      .channel("live_scores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_participants" },
        () => void loadLiveEvents(),
      )
      .subscribe();

    return () => {
      void subscription.unsubscribe();
    };
  }, []);

  const loadLiveEvents = async () => {
    setLoading(true);
    try {
      const { data: events, error } = await supabase
        .from("rodeo_events")
        .select("*")
        .eq("is_live", true)
        .order("start_date", { ascending: false });

      if (error) throw error;

      if (events && events.length > 0) {
        const eventsWithParticipants = await Promise.all(
          events.map(async (event) => {
            const { data: participants } = await supabase
              .from("event_participants")
              .select("*")
              .eq("event_id", event.id)
              .order("position", { ascending: true, nullsFirst: false });

            return {
              id: event.id,
              event_name: event.event_name,
              start_date: event.start_date,
              is_live: event.is_live,
              participants: (participants || []) as LiveEventParticipant[],
            };
          }),
        );

        setLiveEvents(eventsWithParticipants);
        setSelectedEvent((prev) => {
          if (prev && eventsWithParticipants.some((e) => e.id === prev)) {
            return prev;
          }
          return eventsWithParticipants[0]?.id ?? null;
        });
      } else {
        setLiveEvents([]);
        setSelectedEvent(null);
      }
    } catch (error) {
      console.error("Error loading live events:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: number | null) => {
    if (!time) return "--";
    return time.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "#10b981";
      case "running":
        return "#3b82f6";
      case "scratched":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const selectedEventData = liveEvents.find((e) => e.id === selectedEvent);

  return (
    <View className="flex-1 bg-background">
      {compactHeader ? (
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-border bg-card">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <Ionicons name="trophy" size={26} color="#ef4444" />
            <Typography.Body2 className="text-secondaryText flex-1">
              Live leaderboards for events currently in progress.
            </Typography.Body2>
          </View>
          <LiveBadge />
        </View>
      ) : (
        <View className="flex-row items-center justify-between px-5 py-5 border-b border-border bg-card">
          <View className="flex-row items-center flex-1">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="pr-4"
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </Pressable>
            <Ionicons name="trophy" size={24} color="#ef4444" />
            <Typography.Heading2 className="text-primaryText ml-3">
              Live Results
            </Typography.Heading2>
          </View>
          <LiveBadge />
        </View>
      )}

      {selectedEvent ? <MyDrawPosition eventId={selectedEvent} /> : null}

      {liveEvents.length === 0 ? (
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="time-outline" size={64} color="#d1d5db" />
          <Typography.Heading3 className="text-primaryText mt-4 mb-2">
            No Live Events
          </Typography.Heading3>
          <Typography.Body2 className="text-secondaryText text-center">
            Check back when events are in progress
          </Typography.Body2>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="max-h-[60px] bg-card border-b border-border"
            contentContainerStyle={{ paddingHorizontal: 8 }}
          >
            {liveEvents.map((event) => {
              const active = selectedEvent === event.id;
              return (
                <Pressable
                  key={event.id}
                  className={`px-5 py-4 border-b-2 ${
                    active ? "border-red-500" : "border-transparent"
                  }`}
                  onPress={() => setSelectedEvent(event.id)}
                >
                  <Typography.Body2
                    className={`font-poppins-semibold ${
                      active ? "text-red-500" : "text-secondaryText"
                    }`}
                  >
                    {event.event_name}
                  </Typography.Body2>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            className="flex-1"
            refreshControl={
              <AppRefreshControl
                refreshing={loading}
                onRefresh={loadLiveEvents}
              />
            }
          >
            {selectedEventData ? (
              <View className="p-4 pb-8">
                <View className="flex-row justify-between items-center mb-4">
                  <Typography.Heading3 className="text-primaryText">
                    Leaderboard
                  </Typography.Heading3>
                  <Typography.Body2 className="text-secondaryText">
                    {selectedEventData.participants.filter((p) => p.has_run)
                      .length}{" "}
                    / {selectedEventData.participants.length} riders
                  </Typography.Body2>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="max-h-[52px] mb-2"
                  contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
                >
                  <Pressable
                    className={`px-4 py-2 rounded-full mx-1 ${
                      !divisionFilter ? "bg-red-500" : "bg-muted"
                    }`}
                    onPress={() => setDivisionFilter(null)}
                  >
                    <Typography.Body2
                      className={`font-poppins-semibold ${
                        !divisionFilter ? "text-white" : "text-secondaryText"
                      }`}
                    >
                      All
                    </Typography.Body2>
                  </Pressable>
                  {DIVISIONS.map((div) => {
                    const active = divisionFilter === div;
                    return (
                      <Pressable
                        key={div}
                        className={`px-4 py-2 rounded-full mx-1 ${
                          active ? "bg-red-500" : "bg-muted"
                        }`}
                        onPress={() => setDivisionFilter(div)}
                      >
                        <Typography.Body2
                          className={`font-poppins-semibold ${
                            active ? "text-white" : "text-secondaryText"
                          }`}
                        >
                          {div}
                        </Typography.Body2>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {selectedEventData.participants
                  .filter(
                    (p) =>
                      !divisionFilter || p.time_division === divisionFilter,
                  )
                  .map((participant) => (
                    <View
                      key={participant.id}
                      className="bg-card border border-border rounded-xl p-4 mb-3 flex-row items-center"
                    >
                      <View className="w-[50px] items-center">
                        {participant.position &&
                        participant.position <= 3 ? (
                          <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{
                              backgroundColor: getMedalColor(
                                participant.position,
                              ),
                            }}
                          >
                            <Text className="text-lg font-bold text-white">
                              {participant.position}
                            </Text>
                          </View>
                        ) : (
                          <Typography.Heading2 className="text-secondaryText">
                            {participant.position || "-"}
                          </Typography.Heading2>
                        )}
                      </View>

                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center mb-1">
                          <Typography.Body1 className="text-primaryText font-poppins-semibold flex-1">
                            {participant.rider_name}
                          </Typography.Body1>
                          <View
                            className="px-2 py-0.5 rounded-lg"
                            style={{
                              backgroundColor: getStatusColor(
                                participant.status,
                              ),
                            }}
                          >
                            <Typography.Caption1 className="text-white font-bold">
                              {participant.status.toUpperCase()}
                            </Typography.Caption1>
                          </View>
                        </View>
                        <Typography.Body2 className="text-secondaryText">
                          {participant.horse_name &&
                            `${participant.horse_name} • `}
                          {participant.division && `${participant.division} • `}
                          {participant.time_division &&
                            `${participant.time_division} • `}
                          Bib #{participant.bib_number}
                        </Typography.Body2>
                      </View>

                      <View className="items-end min-w-[80px]">
                        <Typography.Heading3 className="text-primaryText">
                          {formatTime(participant.run_time)}
                        </Typography.Heading3>
                        {participant.penalties > 0 ? (
                          <Typography.Body2 className="text-red-500 font-poppins-semibold">
                            +{participant.penalties}s
                          </Typography.Body2>
                        ) : null}
                      </View>
                    </View>
                  ))}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}
    </View>
  );
};

function getMedalColor(position: number) {
  switch (position) {
    case 1:
      return "#fbbf24";
    case 2:
      return "#9ca3af";
    case 3:
      return "#d97706";
    default:
      return "#e5e7eb";
  }
}

export default LiveResultsContent;
