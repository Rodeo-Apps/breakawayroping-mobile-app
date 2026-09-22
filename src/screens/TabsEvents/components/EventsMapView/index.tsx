import { View } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { EmptyState, Loader } from "@/components";
import { Typography } from "@/utils/typography";
import { T_EVENT_ITEM, useGetEvents } from "@/services/supabase/useGetEvents";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const US_FALLBACK = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

function getEventCoord(
  e: T_EVENT_ITEM,
): { latitude: number; longitude: number } | null {
  const lat = e.latitude != null ? Number(e.latitude) : NaN;
  const lng = e.longitude != null ? Number(e.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

const EventsMapView = () => {
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const { events, loading, error } = useGetEvents();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const eventsWithCoords = useMemo(
    () => events.filter((e) => getEventCoord(e) != null),
    [events],
  );

  const initialRegion = useMemo(() => {
    const first = eventsWithCoords[0];
    const c = first ? getEventCoord(first) : null;
    if (c) {
      return {
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: 2.5,
        longitudeDelta: 2.5,
      };
    }
    return US_FALLBACK;
  }, [eventsWithCoords]);

  /** Google Maps often needs a beat after layout before bounds fit correctly. */
  useEffect(() => {
    if (eventsWithCoords.length === 0) return;

    const coords = eventsWithCoords.map((e) => getEventCoord(e)!);
    const pad = {
      top: 72 + insets.top,
      right: 40,
      bottom: 96 + insets.bottom,
      left: 40,
    };

    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      if (coords.length === 1) {
        map.animateToRegion(
          {
            ...coords[0],
            latitudeDelta: 0.45,
            longitudeDelta: 0.45,
          },
          400,
        );
      } else {
        map.fitToCoordinates(coords, {
          edgePadding: pad,
          animated: true,
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [eventsWithCoords, insets.top, insets.bottom]);

  const openEventDetails = useCallback((eventId: string) => {
    router.push({
      pathname: "/(tabs)/(events)/[eventId]",
      params: { eventId },
    });
  }, []);

  if (loading) {
    return <Loader message="Loading active events..." />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={
          <Ionicons
            name="calendar-outline"
            size={28}
            color={secondaryTextColor}
          />
        }
        message={error || "No upcoming events found."}
      />
    );
  }

  const hasAnyPin = eventsWithCoords.length > 0;

  return (
    <View className="flex-1 px-5" style={{marginBottom: insets.bottom}}>
      <View className="flex-1 rounded-2xl overflow-hidden border border-border">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsMyLocationButton={false}
        >
          {events.map((item) => {
            const coord = getEventCoord(item);
            if (!coord) return null;
            const title = item.event_name || item.name || "Event";
            const subtitle = item.location_name || item.address || undefined;
            return (
              <Marker
                key={item.id}
                coordinate={coord}
                title={title}
                description={subtitle}
                onPress={() => openEventDetails(item.id)}
              />
            );
          })}
        </MapView>
        {!hasAnyPin ? (
          <View
            className="absolute left-3 right-3 bottom-3 rounded-2xl bg-background/95 border border-border p-4 gap-y-2"
            pointerEvents="none"
          >
            <Typography.Caption1 className="text-secondaryText text-center">
              None of these events include map coordinates yet. When organizers
              add latitude and longitude, pins will appear here.
            </Typography.Caption1>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default EventsMapView;
