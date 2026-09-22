import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Notifications feed, ported from BarrelConnect. Reads `notifications` for the
// current user and marks them read on tap.

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  related_user_id: string | null;
  related_post_id: string | null;
  created_at: string;
};

export function NotificationsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, related_user_id, related_post_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const onPress = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.related_user_id) router.push(`/user/${n.related_user_id}`);
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      {items.some((n) => !n.is_read) ? (
        <TouchableOpacity style={st.markAll} onPress={markAllRead}>
          <Text style={st.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={st.list}
        ListEmptyComponent={<Text style={st.empty}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[st.row, !item.is_read && st.unread]} onPress={() => onPress(item)}>
            <View style={st.rowBody}>
              <Text style={st.title}>{item.title}</Text>
              {item.body ? (
                <Text style={st.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={st.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            {!item.is_read ? <View style={st.dot} /> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  markAll: { alignItems: 'flex-end', paddingHorizontal: spacing.screenX, paddingTop: 12 },
  markAllText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  list: { padding: spacing.screenX, gap: 6 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.cardPad,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { borderColor: colors.accent },
  rowBody: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
