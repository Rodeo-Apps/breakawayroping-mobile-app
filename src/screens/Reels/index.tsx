import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/constants/theme';

// Reels / video feed, ported from BarrelConnect. Reads video `posts` (the
// ported stories/reels are modelled as posts with post_type='video').

type Reel = {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
  author?: { name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function ReelsScreen() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, user_id, content, media_urls, like_count, comment_count, created_at')
      .eq('post_type', 'video')
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .limit(60);
    const rows = (data as Reel[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', ids);
      const map = new Map<string, { name: string | null; username: string | null; avatar_url: string | null }>();
      for (const p of (profs as { id: string; name: string | null; username: string | null; avatar_url: string | null }[]) ?? []) {
        map.set(p.id, { name: p.name, username: p.username, avatar_url: p.avatar_url });
      }
      for (const r of rows) r.author = map.get(r.user_id) ?? null;
    }
    setReels(rows);
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
      data={reels}
      keyExtractor={(r) => r.id}
      contentContainerStyle={st.list}
      ListEmptyComponent={<Text style={st.empty}>No reels yet. Share a video from the feed to get started.</Text>}
      renderItem={({ item }) => {
        const cover = item.media_urls && item.media_urls.length > 0 ? item.media_urls[0] : null;
        return (
          <View style={st.card}>
            <TouchableOpacity style={st.author} onPress={() => router.push(`/user/${item.user_id}`)}>
              {item.author?.avatar_url ? (
                <Image source={{ uri: item.author.avatar_url }} style={st.avatar} />
              ) : (
                <View style={[st.avatar, st.avatarPlaceholder]} />
              )}
              <Text style={st.authorName}>{item.author?.name ?? item.author?.username ?? 'Roper'}</Text>
            </TouchableOpacity>
            {cover ? (
              <Image source={{ uri: cover }} style={st.media} resizeMode="cover" />
            ) : (
              <View style={[st.media, st.mediaPlaceholder]}>
                <Text style={st.playIcon}>▶</Text>
              </View>
            )}
            {item.content ? (
              <Text style={st.caption} numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}
            <Text style={st.meta}>
              ♥ {item.like_count ?? 0} · 💬 {item.comment_count ?? 0}
            </Text>
          </View>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, paddingBottom: 40, gap: 16 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60, lineHeight: 21 },
  card: { gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  authorName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  media: { width: '100%', height: 360, borderRadius: radius.card, backgroundColor: colors.card },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: colors.muted, fontSize: 40 },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 13 },
});
