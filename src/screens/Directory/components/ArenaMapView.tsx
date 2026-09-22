import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, radius } from '@/constants/theme';

// Arena map, ported from BarrelConnect and adapted to Breakaway Roping's theme
// and Arena shape. Plots arenas that have latitude/longitude.
//
// GRACEFUL DEGRADATION: arenas without coordinates are simply skipped; when none
// have coordinates an overlay explains that no pins are available. A missing
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY only affects Android tile rendering — the
// component still mounts and the list view remains fully functional.

export type MapArena = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

function coord(a: MapArena): { latitude: number; longitude: number } | null {
  const lat = a.latitude != null ? Number(a.latitude) : NaN;
  const lng = a.longitude != null ? Number(a.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

const US_FALLBACK = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

export default function ArenaMapView({
  arenas,
  onMarkerPress,
}: {
  arenas: MapArena[];
  onMarkerPress?: (arena: MapArena) => void;
}) {
  const initialRegion = useMemo(() => {
    const withCoord = arenas.find((a) => coord(a));
    const c = withCoord ? coord(withCoord) : null;
    if (c) {
      return { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 2.5, longitudeDelta: 2.5 };
    }
    return US_FALLBACK;
  }, [arenas]);

  const hasAnyPin = arenas.some((a) => coord(a) != null);

  return (
    <View style={st.wrap}>
      <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
        {arenas.map((arena) => {
          const c = coord(arena);
          if (!c) return null;
          return (
            <Marker
              key={arena.id}
              coordinate={c}
              title={arena.name}
              description={[arena.city, arena.state].filter(Boolean).join(', ') || undefined}
              onPress={() => onMarkerPress?.(arena)}
            />
          );
        })}
      </MapView>
      {!hasAnyPin ? (
        <View style={st.overlay} pointerEvents="none">
          <Text style={st.overlayText}>
            No arenas have map coordinates yet. Switch to the list to browse them.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overlayText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
