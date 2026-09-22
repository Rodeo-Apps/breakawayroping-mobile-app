import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Direct-message inbox, ported from BarrelConnect. Groups `messages` rows into
// conversation threads keyed by the other participant.

type Thread = {
  otherId: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  lastContent: string;
  lastAt: string;
  unread: boolean;
};

type Row = {
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
  read_at: string | null;
};

export function MessagesScreen() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('sender_id, recipient_id, content, created_at, read_at')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(300);

    const rows = (data as Row[]) ?? [];
    const byOther = new Map<string, Row>();
    for (const r of rows) {
      const other = r.sender_id === user.id ? r.recipient_id : r.sender_id;
      if (!byOther.has(other)) byOther.set(other, r);
    }
    const otherIds = Array.from(byOther.keys());
    if (otherIds.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', otherIds);
    const profMap = new Map<string, { name: string | null; username: string | null; avatar_url: string | null }>();
    for (const p of (profs as { id: string; name: string | null; username: string | null; avatar_url: string | null }[]) ?? []) {
      profMap.set(p.id, { name: p.name, username: p.username, avatar_url: p.avatar_url });
    }
    const result: Thread[] = [];
    for (const [otherId, last] of byOther.entries()) {
      const p = profMap.get(otherId);
      result.push({
        otherId,
        name: p?.name ?? null,
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        lastContent: last.content ?? '(attachment)',
        lastAt: last.created_at,
        unread: last.recipient_id === user.id && !last.read_at,
      });
    }
    result.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    setThreads(result);
    setLoading(false);
  }, [user]);

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
    <View style={st.container}>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.otherId}
        contentContainerStyle={st.list}
        ListEmptyComponent={
          <Text style={st.empty}>No messages yet. Start a conversation from a profile or listing.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={st.row} onPress={() => router.push(`/messages/${item.otherId}`)}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={st.avatar} />
            ) : (
              <View style={[st.avatar, st.avatarPlaceholder]} />
            )}
            <View style={st.rowBody}>
              <Text style={st.name} numberOfLines={1}>
                {item.name ?? item.username ?? 'Roper'}
              </Text>
              <Text style={[st.preview, item.unread && st.previewUnread]} numberOfLines={1}>
                {item.lastContent}
              </Text>
            </View>
            {item.unread ? <View style={st.dot} /> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, gap: 6 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.card,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  rowBody: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  preview: { color: colors.muted, fontSize: 14 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
