import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Coaching marketplace, ported from BarrelConnect. Lists available
// `coaching_sessions` and books via `coaching_bookings`. Discipline-agnostic.

type Session = {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  session_type: string;
  duration_minutes: number | null;
  price_cents: number;
  max_participants: number | null;
  current_participants: number | null;
  session_date: string | null;
  is_online: boolean;
  location: string | null;
};

function money(cents: number): string {
  return cents === 0 ? 'Free' : `$${(cents / 100).toFixed(0)}`;
}

export function CoachingScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('coaching_sessions')
      .select(
        'id, coach_id, title, description, session_type, duration_minutes, price_cents, max_participants, current_participants, session_date, is_online, location',
      )
      .eq('is_available', true)
      .order('session_date', { ascending: true, nullsFirst: false })
      .limit(100);
    setSessions((data as Session[]) ?? []);
    if (user) {
      const { data: bookings } = await supabase
        .from('coaching_bookings')
        .select('session_id')
        .eq('user_id', user.id);
      setBookedIds(new Set(((bookings as { session_id: string }[]) ?? []).map((b) => b.session_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (session: Session) => {
    if (!user) return;
    if (bookedIds.has(session.id)) return;
    const { error } = await supabase
      .from('coaching_bookings')
      .insert({ session_id: session.id, user_id: user.id, coach_id: session.coach_id });
    if (error) {
      Alert.alert('Could not book', error.message);
      return;
    }
    setBookedIds((prev) => new Set(prev).add(session.id));
    Alert.alert('Booked', 'Your coaching session is booked.');
  };

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
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={st.list}
      ListEmptyComponent={<Text style={st.empty}>No coaching sessions available yet.</Text>}
      renderItem={({ item }) => {
        const booked = bookedIds.has(item.id);
        const full =
          item.max_participants != null &&
          item.current_participants != null &&
          item.current_participants >= item.max_participants;
        return (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Text style={st.title}>{item.title}</Text>
              <Text style={st.price}>{money(item.price_cents)}</Text>
            </View>
            <Text style={st.meta}>
              {item.session_type}
              {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
              {item.is_online ? ' · Online' : item.location ? ` · ${item.location}` : ''}
            </Text>
            {item.session_date ? (
              <Text style={st.muted}>{new Date(item.session_date).toLocaleString()}</Text>
            ) : null}
            {item.description ? (
              <Text style={st.desc} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[st.btn, (booked || full) && st.btnDisabled]}
              onPress={() => book(item)}
              disabled={booked || full}
            >
              <Text style={st.btnText}>{booked ? 'Booked' : full ? 'Full' : 'Book session'}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  price: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.accentAlt, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  muted: { color: colors.muted, fontSize: 13 },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
