import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Weekly points leaderboard, ported from BarrelConnect. Calls the ported
// get_weekly_leaderboard RPC (SECURITY DEFINER).

type Row = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  total_points: number;
  rank: number;
};

function weekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function LeaderboardScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
      p_week_start: weekStart(),
      p_limit: 100,
    });
    if (!error && data) {
      setRows(
        (data as { user_id: string; name: string | null; avatar_url: string | null; total_points: number; rank: number }[]).map(
          (r) => ({ ...r, total_points: Number(r.total_points), rank: Number(r.rank) }),
        ),
      );
    }
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
      data={rows}
      keyExtractor={(r) => r.user_id}
      contentContainerStyle={st.list}
      ListHeaderComponent={<Text style={st.header}>This week's top ropers</Text>}
      ListEmptyComponent={<Text style={st.empty}>No points logged this week yet. Log a run to get on the board!</Text>}
      renderItem={({ item }) => {
        const isMe = item.user_id === user?.id;
        const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
        return (
          <View style={[st.row, isMe && st.rowMe]}>
            <Text style={st.rank}>{medal ?? `#${item.rank}`}</Text>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={st.avatar} />
            ) : (
              <View style={[st.avatar, st.avatarPlaceholder]} />
            )}
            <Text style={st.name} numberOfLines={1}>
              {item.name ?? 'Roper'}
              {isMe ? ' (you)' : ''}
            </Text>
            <Text style={st.points}>{item.total_points}</Text>
          </View>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, gap: 6 },
  header: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.accent },
  rank: { color: colors.text, fontSize: 16, fontWeight: '800', width: 36 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  points: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
