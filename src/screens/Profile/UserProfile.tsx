import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Public profile, ported from BarrelConnect. Shows another user's profile with
// follow / message actions and follower counts.

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function UserProfileScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : undefined;
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: prof }, followersRes, followingRes] = await Promise.all([
      supabase.from('profiles').select('id, name, username, avatar_url, bio').eq('id', userId).maybeSingle(),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
    setProfile((prof as Profile) ?? null);
    setFollowers(followersRes.count ?? 0);
    setFollowing(followingRes.count ?? 0);
    if (user && user.id !== userId) {
      const { data: f } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      setIsFollowing(!!f);
    }
    setLoading(false);
  }, [userId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!user || !userId) return;
    if (isFollowing) {
      setIsFollowing(false);
      setFollowers((c) => Math.max(0, c - 1));
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
    } else {
      setIsFollowing(true);
      setFollowers((c) => c + 1);
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
    }
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={st.center}>
        <Text style={st.muted}>Profile not found.</Text>
      </View>
    );
  }

  const isSelf = user?.id === profile.id;

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <View style={st.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={st.avatar} />
        ) : (
          <View style={[st.avatar, st.avatarPlaceholder]}>
            <Text style={st.avatarText}>{(profile.name ?? profile.username ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={st.name}>{profile.name ?? profile.username ?? 'Roper'}</Text>
        {profile.username ? <Text style={st.muted}>@{profile.username}</Text> : null}
        {profile.bio ? <Text style={st.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={st.countsRow}>
        <TouchableOpacity
          style={st.count}
          onPress={() => router.push(`/user/${profile.id}/connections?mode=followers`)}
        >
          <Text style={st.countValue}>{followers}</Text>
          <Text style={st.countLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.count}
          onPress={() => router.push(`/user/${profile.id}/connections?mode=following`)}
        >
          <Text style={st.countValue}>{following}</Text>
          <Text style={st.countLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {isSelf ? (
        <TouchableOpacity style={st.secondary} onPress={() => router.push('/edit-profile')}>
          <Text style={st.secondaryText}>Edit profile</Text>
        </TouchableOpacity>
      ) : (
        <View style={st.actions}>
          <TouchableOpacity style={[st.primary, isFollowing && st.following]} onPress={toggleFollow}>
            <Text style={[st.primaryText, isFollowing && st.followingText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.secondary} onPress={() => router.push(`/messages/${profile.id}`)}>
            <Text style={st.secondaryText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.screenX, gap: 20, paddingBottom: 60 },
  muted: { color: colors.muted, fontSize: 14 },
  header: { alignItems: 'center', gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  bio: { color: colors.text, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 4 },
  countsRow: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  count: { alignItems: 'center', gap: 2 },
  countValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  countLabel: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12 },
  primary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: 'center',
  },
  following: { backgroundColor: 'transparent', borderColor: colors.border },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  followingText: { color: colors.muted },
  secondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
