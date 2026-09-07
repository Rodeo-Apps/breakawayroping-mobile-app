import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing, app } from '@/constants/theme';
import { useGetEvents, type EventItem } from '@/services/supabase/useGetEvents';

function formatWindow(ev: EventItem): string {
  if (!ev.start_date) return 'Dates TBA';
  const start = new Date(ev.start_date);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (ev.end_date) {
    const end = new Date(ev.end_date);
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }
  return start.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
}

function placeOf(ev: EventItem): string {
  const parts = [ev.city, ev.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return ev.location ?? 'Location TBA';
}

export function EventsScreen() {
  const { events, loading, error, refetch } = useGetEvents();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <Text style={st.title}>Events</Text>
      <Text style={st.sub}>Upcoming {app.eventLabel} events and jackpots.</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : error ? (
        <EmptyState title="Could not load events" body={error} actionLabel="Retry" onAction={refetch} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="When producers post events for this discipline they will show up here. Pull down to refresh."
        />
      ) : (
        events.map((ev) => (
          <TouchableOpacity
            key={ev.id}
            style={st.card}
            onPress={() => router.push(`/event/${ev.id}`)}
          >
            <Text style={st.cardTitle}>{ev.title}</Text>
            <Text style={st.cardMeta}>{formatWindow(ev)}</Text>
            <Text style={st.cardMeta}>{placeOf(ev)}</Text>
            {ev.description ? (
              <Text style={st.cardBody} numberOfLines={2}>
                {ev.description}
              </Text>
            ) : null}
            <View style={st.rowEnd}>
              <Text style={st.link}>View details ›</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
  cardBody: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13 },
});
