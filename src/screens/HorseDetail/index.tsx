import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useHorse } from '@/services/supabase/useHorse';

export function HorseDetailScreen() {
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { horse, runs, loading, error } = useHorse(horseId);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !horse) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="Not found" body={error ?? 'This record may have been removed.'} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>{horse.name ?? 'Unnamed'}</Text>

      <View style={st.card}>
        <Row label="Breed" value={horse.breed ?? '—'} />
        <Row label="Age" value={horse.age != null ? `${horse.age} years` : '—'} />
        <Row label="Color" value={horse.color ?? '—'} />
      </View>

      {horse.notes ? (
        <View style={st.card}>
          <Text style={st.sectionTitle}>Notes</Text>
          <Text style={st.body}>{horse.notes}</Text>
        </View>
      ) : null}

      <Text style={st.sectionTitle}>Runs on this horse</Text>
      {runs.length === 0 ? (
        <Text style={st.muted}>
          No runs linked yet. Runs logged with this horse&apos;s name will appear here.
        </Text>
      ) : (
        runs.map((r) => (
          <View key={r.id} style={st.runCard}>
            <Text style={st.runPrimary}>{String(r.metric ?? '—')}</Text>
            <Text style={st.runDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            {r.notes ? <Text style={st.runNotes}>{r.notes}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.rowValue}>{value}</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  runCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  runPrimary: { fontSize: 18, fontWeight: '700', color: colors.text },
  runDate: { fontSize: 12, color: colors.muted },
  runNotes: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
