import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/constants/theme';

// Marketplace listings, ported from BarrelConnect's TabsMarketplace. Wired to the
// ported `marketplace_listings` (+ `listing_photos`) tables. Discipline-agnostic.

const CATEGORIES = ['all', 'horse', 'tack', 'trailer', 'service'] as const;
type Category = (typeof CATEGORIES)[number];

export type Listing = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location_city: string | null;
  location_state: string | null;
  status: string;
  created_at: string;
  cover?: string | null;
};

export function MarketplaceScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    let q = supabase
      .from('marketplace_listings')
      .select('id, title, description, category, price, location_city, location_state, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    if (category !== 'all') q = q.eq('category', category);
    const { data } = await q;
    setListings((data as Listing[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [category]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = listings.filter(
    (l) => !query.trim() || l.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TextInput
          style={st.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search listings…"
          placeholderTextColor={colors.muted}
        />
        <View style={st.chips}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[st.chip, category === c && st.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[st.chipText, category === c && st.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <Text style={st.empty}>No listings yet. Tap “Sell an item” to post the first one.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={st.card} onPress={() => router.push(`/marketplace/${item.id}`)}>
              <View style={st.cardHead}>
                <Text style={st.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={st.price}>${item.price.toLocaleString()}</Text>
              </View>
              <Text style={st.cardDesc} numberOfLines={2}>{item.description}</Text>
              <View style={st.cardMeta}>
                <Text style={st.metaTag}>{item.category}</Text>
                {item.location_city ? (
                  <Text style={st.metaLoc}>
                    {item.location_city}
                    {item.location_state ? `, ${item.location_state}` : ''}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={st.fab} onPress={() => router.push('/marketplace/create')}>
        <Text style={st.fabText}>＋ Sell an item</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.screenX, gap: 12 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: 120, gap: 12 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  price: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  cardDesc: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  metaTag: {
    color: colors.text,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  metaLoc: { color: colors.muted, fontSize: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
