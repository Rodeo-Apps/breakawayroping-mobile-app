import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/constants/theme';

// Hauler / transport directory, ported from BarrelConnect. Reads `haulers`.

type Hauler = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  service_area_states: string[] | null;
  is_verified: boolean;
  trailer_types: string[] | null;
  price_range: string | null;
  average_rating: number | null;
  phone_number: string | null;
  website: string | null;
  description: string | null;
};

export function HaulersScreen() {
  const [haulers, setHaulers] = useState<Hauler[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('haulers')
      .select(
        'id, business_name, city, state, service_area_states, is_verified, trailer_types, price_range, average_rating, phone_number, website, description',
      )
      .eq('is_active', true)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(100);
    setHaulers((data as Hauler[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = haulers.filter((h) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      h.business_name.toLowerCase().includes(q) ||
      (h.state ?? '').toLowerCase().includes(q) ||
      (h.service_area_states ?? []).some((s) => s.toLowerCase().includes(q))
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
          placeholder="Search haulers by name or state..."
          placeholderTextColor={colors.muted}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(h) => h.id}
        contentContainerStyle={st.list}
        ListEmptyComponent={<Text style={st.empty}>No haulers listed yet.</Text>}
        renderItem={({ item }) => (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Text style={st.name}>
                {item.business_name}
                {item.is_verified ? '  ✓' : ''}
              </Text>
              {item.average_rating ? <Text style={st.rating}>★ {item.average_rating.toFixed(1)}</Text> : null}
            </View>
            {item.city || item.state ? (
              <Text style={st.muted}>
                {[item.city, item.state].filter(Boolean).join(', ')}
                {item.price_range ? ` · ${item.price_range}` : ''}
              </Text>
            ) : null}
            {item.description ? (
              <Text style={st.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            {item.trailer_types && item.trailer_types.length > 0 ? (
              <View style={st.tags}>
                {item.trailer_types.slice(0, 4).map((t) => (
                  <Text key={t} style={st.tag}>
                    {t}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={st.actions}>
              {item.phone_number ? (
                <TouchableOpacity style={st.btn} onPress={() => Linking.openURL(`tel:${item.phone_number}`)}>
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
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.screenX },
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
