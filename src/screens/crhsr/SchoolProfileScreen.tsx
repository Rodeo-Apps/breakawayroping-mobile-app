import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useSchoolRoster } from '@/services/supabase/useSchoolRoster';

export function SchoolProfileScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { school, roster, loading, error } = useSchoolRoster(schoolId);

  const verified = roster.filter((r) => r.status === 'verified');

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !school) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="School not found" body={error ?? 'This school may not exist.'} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>{school.name}</Text>
      <View style={st.card}>
        <Row label="Level" value={school.level === 'college' ? 'College' : 'High school'} />
        <Row label="Association" value={school.association ?? '—'} />
        <Row label="Region" value={school.region ?? '—'} />
        <Row label="State" value={school.state ?? '—'} />
        <Row label="Athletes" value={String(verified.length)} />
      </View>

      <Text style={st.sectionTitle}>Roster standings</Text>
      {verified.length === 0 ? (
        <Text style={st.muted}>No verified athletes yet.</Text>
      ) : (
        verified.map((a, i) => (
          <View key={a.id} style={st.row}>
            <Text style={st.rank}>{i + 1}</Text>
            <Text style={st.name}>{a.name}</Text>
            <Text style={st.pts}>{a.season_points} pts</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.metaRow}>
      <Text style={st.metaLabel}>{label}</Text>
      <Text style={st.metaValue}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 13, color: colors.muted },
  metaValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rank: { fontSize: 14, fontWeight: '700', color: colors.accent, width: 24 },
  name: { fontSize: 15, color: colors.text, flex: 1 },
  pts: { fontSize: 14, color: colors.muted, fontWeight: '600' },
});
