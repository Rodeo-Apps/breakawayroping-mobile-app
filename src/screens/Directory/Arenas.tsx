import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Linking } from 'react-native';

import { supabase } from '@/lib/supabase';
import ArenaMapView from '@/screens/Directory/components/ArenaMapView';
import { colors, radius, spacing } from '@/constants/theme';

// Arena directory, ported from BarrelConnect. Reads the `arenas` table.

type Arena = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  arena_type: string | null;
  amenities: string[] | null;
  rating: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function ArenasScreen() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('arenas')
      .select('id, name, city, state, phone, website, arena_type, amenities, rating, description, latitude, longitude')
      .eq('is_active', true)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(100);
    setArenas((data as Arena[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = arenas.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      (a.city ?? '').toLowerCase().includes(q) ||
      (a.state ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TextInput
          style={st.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search arenas by name or city..."
          placeholderTextColor={colors.muted}
        />
        <View style={st.toggle}>
          <TouchableOpacity
            style={[st.toggleBtn, !showMap && st.toggleActive]}
            onPress={() => setShowMap(false)}
          >
            <Text style={[st.toggleText, !showMap && st.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.toggleBtn, showMap && st.toggleActive]}
            onPress={() => setShowMap(true)}
          >
            <Text style={[st.toggleText, showMap && st.toggleTextActive]}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>
      {showMap ? (
        <ArenaMapView arenas={filtered} />
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={st.list}
        ListEmptyComponent={<Text style={st.empty}>No arenas listed yet.</Text>}
        renderItem={({ item }) => (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Text style={st.name}>{item.name}</Text>
              {item.rating ? <Text style={st.rating}>★ {item.rating.toFixed(1)}</Text> : null}
            </View>
            {item.city ? (
              <Text style={st.muted}>
                {item.city}
                {item.state ? `, ${item.state}` : ''}
                {item.arena_type ? ` · ${item.arena_type}` : ''}
              </Text>
            ) : null}
            {item.description ? (
              <Text style={st.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            {item.amenities && item.amenities.length > 0 ? (
              <View style={st.tags}>
                {item.amenities.slice(0, 4).map((am) => (
                  <Text key={am} style={st.tag}>
                    {am}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={st.actions}>
              {item.phone ? (
                <TouchableOpacity style={st.btn} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                  <Text style={st.btnText}>Call</Text>
                </TouchableOpacity>
              ) : null}
              {item.website ? (
                <TouchableOpacity
                  style={st.btn}
                  onPress={() => Linking.openURL(item.website!.startsWith('http') ? item.website! : `https://${item.website}`)}
                >
                  <Text style={st.btnText}>Website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.screenX, gap: 10 },
  toggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  toggleTextActive: { color: '#fff' },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: 40, gap: 12 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  rating: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  desc: { color: colors.text, fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: {
    color: colors.muted,
    fontSize: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  btnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
