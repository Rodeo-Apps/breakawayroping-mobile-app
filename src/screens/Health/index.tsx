import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Stat } from '@/components/ui/Stat';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Horse health hub, ported from BarrelConnect. Combines the health dashboard,
// vet records, care schedule and nutrition log over the ported tables
// (horse_health_records / care_events / horse_nutrition_logs).

type Tab = 'overview' | 'vet' | 'care' | 'nutrition';

type VetRecord = {
  id: string;
  record_type: string;
  visit_date: string;
  veterinarian_name: string | null;
  diagnosis: string | null;
  status: string;
  horse_id: string;
};

type CareEvent = {
  id: string;
  event_type: string;
  title: string;
  scheduled_date: string;
  status: string;
};

type NutritionLog = {
  id: string;
  log_date: string;
  item_name: string;
  meal_type: string;
  calories: number | null;
  horse_name: string | null;
};

export function HealthScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [vet, setVet] = useState<VetRecord[]>([]);
  const [care, setCare] = useState<CareEvent[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [v, c, n] = await Promise.all([
      supabase
        .from('horse_health_records')
        .select('id, record_type, visit_date, veterinarian_name, diagnosis, status, horse_id')
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false })
        .limit(100),
      supabase
        .from('care_events')
        .select('id, event_type, title, scheduled_date, status')
        .eq('user_id', user.id)
        .order('scheduled_date', { ascending: true })
        .limit(100),
      supabase
        .from('horse_nutrition_logs')
        .select('id, log_date, item_name, meal_type, calories, horse_name')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
        .limit(100),
    ]);
    setVet((v.data as VetRecord[]) ?? []);
    setCare((c.data as CareEvent[]) ?? []);
    setNutrition((n.data as NutritionLog[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const openVet = vet.filter((r) => r.status === 'open').length;
  const upcomingCare = care.filter((c) => c.status === 'scheduled').length;

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'vet', label: 'Vet' },
    { key: 'care', label: 'Care' },
    { key: 'nutrition', label: 'Nutrition' },
  ];

  return (
    <View style={st.container}>
      <View style={st.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[st.tab, tab === t.key && st.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[st.tabText, tab === t.key && st.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {tab === 'overview' ? (
          <View style={st.statRow}>
            <View style={st.statCard}>
              <Stat label="Open vet cases" value={String(openVet)} />
            </View>
            <View style={st.statCard}>
              <Stat label="Upcoming care" value={String(upcomingCare)} />
            </View>
            <View style={st.statCard}>
              <Stat label="Nutrition logs" value={String(nutrition.length)} />
            </View>
          </View>
        ) : null}

        {tab === 'vet'
          ? (vet.length === 0 ? (
              <Text style={st.empty}>No vet records yet.</Text>
            ) : (
              vet.map((r) => (
                <View key={r.id} style={st.card}>
                  <View style={st.cardHead}>
                    <Text style={st.cardTitle}>{r.record_type.replace(/_/g, ' ')}</Text>
                    <Text style={[st.status, r.status === 'open' ? st.statusOpen : st.statusDone]}>{r.status}</Text>
                  </View>
                  <Text style={st.muted}>{new Date(r.visit_date).toLocaleDateString()}</Text>
                  {r.veterinarian_name ? <Text style={st.body}>Vet: {r.veterinarian_name}</Text> : null}
                  {r.diagnosis ? <Text style={st.body}>{r.diagnosis}</Text> : null}
                </View>
              ))
            ))
          : null}

        {tab === 'care'
          ? (care.length === 0 ? (
              <Text style={st.empty}>No care events scheduled.</Text>
            ) : (
              care.map((c) => (
                <View key={c.id} style={st.card}>
                  <View style={st.cardHead}>
                    <Text style={st.cardTitle}>{c.title}</Text>
                    <Text style={[st.status, c.status === 'completed' ? st.statusDone : st.statusOpen]}>{c.status}</Text>
                  </View>
                  <Text style={st.muted}>
                    {c.event_type.replace(/_/g, ' ')} · {new Date(c.scheduled_date).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ))
          : null}

        {tab === 'nutrition'
          ? (nutrition.length === 0 ? (
              <Text style={st.empty}>No nutrition logs yet.</Text>
            ) : (
              nutrition.map((n) => (
                <View key={n.id} style={st.card}>
                  <View style={st.cardHead}>
                    <Text style={st.cardTitle}>{n.item_name}</Text>
                    {n.calories ? <Text style={st.cals}>{n.calories} cal</Text> : null}
                  </View>
                  <Text style={st.muted}>
                    {n.meal_type}
                    {n.horse_name ? ` · ${n.horse_name}` : ''} · {new Date(n.log_date).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8, padding: spacing.screenX, paddingBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: 40, gap: 12 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, textTransform: 'capitalize' },
  status: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusOpen: { color: colors.warning },
  statusDone: { color: colors.success },
  muted: { color: colors.muted, fontSize: 13 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  cals: { color: colors.accentAlt, fontSize: 13, fontWeight: '700' },
});
