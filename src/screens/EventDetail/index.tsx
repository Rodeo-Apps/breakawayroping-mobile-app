import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useGetEventDetails } from '@/services/supabase/useGetEventDetails';

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { event, producerName, loading, error } = useGetEventDetails(eventId);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !event) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="Event not found" body={error ?? 'This event may have been removed.'} />
      </ScrollView>
    );
  }

  const place = [event.city, event.state].filter(Boolean).join(', ') || event.location || 'Location TBA';

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>{event.title}</Text>
      <Text style={st.place}>{place}</Text>

      <View style={st.card}>
        <Row label="Starts" value={fmt(event.start_date)} />
        <Row label="Ends" value={fmt(event.end_date)} />
        <Row label="Entries open" value={fmt(event.entries_open)} />
        <Row label="Entries close" value={fmt(event.entries_close)} />
        {producerName ? <Row label="Producer" value={producerName} /> : null}
      </View>

      {event.description ? (
        <View style={st.card}>
          <Text style={st.sectionTitle}>About</Text>
          <Text style={st.body}>{event.description}</Text>
        </View>
      ) : null}
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
  content: { padding: spacing.screenX, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  place: { fontSize: 15, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
});
