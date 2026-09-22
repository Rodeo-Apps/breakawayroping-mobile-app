import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// People search + follow, ported from BarrelConnect. Searches `profiles` and
// toggles rows in `follows`.

type Person = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function SearchScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setPeople([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, bio')
        .or(`name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(40);
      const rows = ((data as Person[]) ?? []).filter((p) => p.id !== user?.id);
      setPeople(rows);
      setLoading(false);
    },
    [user],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const loadFollowing = async () => {
      if (!user) return;
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      setFollowingIds(new Set(((data as { following_id: string }[]) ?? []).map((r) => r.following_id)));
    };
    loadFollowing();
  }, [user]);

  const toggleFollow = async (targetId: string) => {
    if (!user) return;
    const next = new Set(followingIds);
    if (followingIds.has(targetId)) {
      next.delete(targetId);
      setFollowingIds(next);
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    } else {
      next.add(targetId);
      setFollowingIds(next);
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    }
  };

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TextInput
          style={st.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search ropers by name or @username..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={st.list}
          ListEmptyComponent={
            <Text style={st.empty}>{query.trim() ? 'No ropers found.' : 'Search for people to follow.'}</Text>
          }
          renderItem={({ item }) => (
            <View style={st.row}>
              <TouchableOpacity style={st.rowLeft} onPress={() => router.push(`/user/${item.id}`)}>
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
              <TouchableOpacity
                style={[st.followBtn, followingIds.has(item.id) && st.following]}
                onPress={() => toggleFollow(item.id)}
              >
                <Text style={[st.followText, followingIds.has(item.id) && st.followingText]}>
                  {followingIds.has(item.id) ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.screenX },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: 40, gap: 4 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  rowBody: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  followBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  following: { backgroundColor: 'transparent', borderColor: colors.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingText: { color: colors.muted },
});
