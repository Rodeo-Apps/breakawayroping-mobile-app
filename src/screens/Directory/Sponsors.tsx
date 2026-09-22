import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/constants/theme';

// Sponsor opportunities board, ported from BarrelConnect. Reads
// `sponsor_opportunities`. Discipline-agnostic sponsorship marketplace.

type Opportunity = {
  id: string;
  sponsor_name: string;
  sponsor_industry: string | null;
  opportunity_title: string;
  description: string | null;
  value_range_min_cents: number;
  value_range_max_cents: number;
  requirements: string[] | null;
  application_deadline: string | null;
  status: string;
};

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function SponsorsScreen() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sponsor_opportunities')
      .select(
        'id, sponsor_name, sponsor_industry, opportunity_title, description, value_range_min_cents, value_range_max_cents, requirements, application_deadline, status',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as Opportunity[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={st.container}
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={st.list}
      ListEmptyComponent={<Text style={st.empty}>No sponsorship opportunities open right now.</Text>}
      renderItem={({ item }) => (
        <View style={st.card}>
          <Text style={st.title}>{item.opportunity_title}</Text>
          <Text style={st.sponsor}>
            {item.sponsor_name}
            {item.sponsor_industry ? ` · ${item.sponsor_industry}` : ''}
          </Text>
          {item.description ? (
            <Text style={st.desc} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
          <Text style={st.value}>
            {money(item.value_range_min_cents)} – {money(item.value_range_max_cents)}
          </Text>
          {item.requirements && item.requirements.length > 0 ? (
            <View style={st.tags}>
              {item.requirements.slice(0, 4).map((r) => (
                <Text key={r} style={st.tag}>
                  {r}
                </Text>
              ))}
            </View>
          ) : null}
          {item.application_deadline ? (
            <Text style={st.deadline}>Apply by {new Date(item.application_deadline).toLocaleDateString()}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, paddingBottom: 40, gap: 12 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sponsor: { color: colors.accentAlt, fontSize: 13, fontWeight: '600' },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  value: { color: colors.success, fontSize: 15, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: {
    color: colors.muted,
    fontSize: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  deadline: { color: colors.warning, fontSize: 12, marginTop: 2 },
});
