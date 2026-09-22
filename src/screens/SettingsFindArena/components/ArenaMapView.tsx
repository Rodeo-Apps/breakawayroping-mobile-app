import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Typography } from "@/utils/typography";
import type { T_ARENA_LIST_ITEM } from "@/services/supabase/useArenaFinderList";
import type { Coordinates } from "@/utils/googleMaps";

function getArenaCoord(
  a: T_ARENA_LIST_ITEM,
): { latitude: number; longitude: number } | null {
  const lat = a.latitude != null ? Number(a.latitude) : NaN;
  const lng = a.longitude != null ? Number(a.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

type Props = {
  arenas: T_ARENA_LIST_ITEM[];
  userCoords: Coordinates | null;
  onMarkerPress: (arena: T_ARENA_LIST_ITEM) => void;
};

const US_FALLBACK = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

export default function ArenaMapView({
  arenas,
  userCoords,
  onMarkerPress,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(() => {
    if (userCoords) {
      return {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.85,
        longitudeDelta: 0.85,
      };
    }
    const withCoord = arenas.find((a) => getArenaCoord(a));
    const c = withCoord ? getArenaCoord(withCoord) : null;
    if (c) {
      return {
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: 2.5,
        longitudeDelta: 2.5,
      };
    }
    return US_FALLBACK;
  }, [userCoords, arenas]);

  useEffect(() => {
    if (!userCoords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.85,
        longitudeDelta: 0.85,
      },
      450,
    );
  }, [userCoords?.latitude, userCoords?.longitude]);

  const hasAnyPin = arenas.some((a) => getArenaCoord(a) != null);

  return (
    <View className="flex-1 min-h-[280]">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation={!!userCoords}
        showsMyLocationButton={false}
      >
        {arenas.map((arena) => {
          const coord = getArenaCoord(arena);
          if (!coord) return null;
          return (
            <Marker
              key={arena.id}
              coordinate={coord}
              title={arena.name}
              description={
                arena.distanceLabel
                  ? `${[arena.address, arena.city].filter(Boolean).join(", ")}\n${arena.distanceLabel}`
                  : [arena.address, arena.city].filter(Boolean).join(", ") ||
                    undefined
              }
              onPress={() => onMarkerPress(arena)}
            />
          );
        })}
      </MapView>
      {!hasAnyPin ? (
        <View
          className="absolute left-3 right-3 bottom-3 rounded-xl bg-background/95 border border-border px-3 py-2"
          pointerEvents="none"
        >
          <Typography.Caption1 className="text-secondaryText text-center">
            No map pins match your filters. Arenas need latitude and longitude;
            edit a listing and pick the address from suggestions.
          </Typography.Caption1>
        </View>
      ) : null}
    </View>
  );
}
