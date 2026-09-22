import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/constants/theme';

// Followers / following list, ported from BarrelConnect. `mode` (query param)
// selects which side of `follows` to read for the routed user.

type Person = { id: string; name: string | null; username: string | null; avatar_url: string | null };

export function FollowersScreen() {
  const params = useLocalSearchParams<{ userId: string; mode: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : undefined;
  const mode = params.mode === 'following' ? 'following' : 'followers';
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    // followers => rows where following_id = userId, read follower_id
    // following => rows where follower_id = userId, read following_id
    const selfCol = mode === 'followers' ? 'following_id' : 'follower_id';
    const otherCol = mode === 'followers' ? 'follower_id' : 'following_id';
    const { data } = await supabase.from('follows').select(otherCol).eq(selfCol, userId).limit(300);
    const ids = ((data as Record<string, string>[]) ?? []).map((r) => r[otherCol]).filter(Boolean) as string[];
    if (ids.length === 0) {
      setPeople([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', ids);
    setPeople((profs as Person[]) ?? []);
    setLoading(false);
  }, [userId, mode]);

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
      data={people}
      keyExtractor={(p) => p.id}
      contentContainerStyle={st.list}
      ListEmptyComponent={
        <Text style={st.empty}>{mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={st.row} onPress={() => router.push(`/user/${item.id}`)}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, st.avatarPlaceholder]} />
          )}
          <View style={st.rowBody}>
            <Text style={st.name} numberOfLines={1}>
              {item.name ?? item.username ?? 'Roper'}
            </Text>
            {item.username ? <Text style={st.muted}>@{item.username}</Text> : null}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, gap: 4 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  rowBody: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
});
