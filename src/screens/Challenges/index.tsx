import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Stat } from '@/components/ui/Stat';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Daily challenges, streaks & badges, ported from BarrelConnect. Reads
// daily_challenges / user_challenge_completions / user_streaks / user_badges.

type Challenge = { id: string; title: string; description: string | null; points: number; challenge_date: string };
type Badge = { badge_id: string; badge_name: string; badge_icon: string | null; earned_at: string };

export function ChallengesScreen() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [badges, setBadges] = useState<Badge[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const [ch, comp, streak, bd] = await Promise.all([
      supabase
        .from('daily_challenges')
        .select('id, title, description, points, challenge_date')
        .lte('challenge_date', today)
        .order('challenge_date', { ascending: false })
        .limit(20),
      supabase.from('user_challenge_completions').select('challenge_id').eq('user_id', user.id),
      supabase.from('user_streaks').select('current_streak, longest_streak').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('user_badges')
        .select('badge_id, badge_name, badge_icon, earned_at')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(50),
    ]);
    setChallenges((ch.data as Challenge[]) ?? []);
    setCompletedIds(new Set(((comp.data as { challenge_id: string }[]) ?? []).map((c) => c.challenge_id)));
    const s = streak.data as { current_streak: number; longest_streak: number } | null;
    setCurrentStreak(s?.current_streak ?? 0);
    setLongestStreak(s?.longest_streak ?? 0);
    setBadges((bd.data as Badge[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const complete = async (challenge: Challenge) => {
    if (!user || completedIds.has(challenge.id)) return;
    const { error } = await supabase
      .from('user_challenge_completions')
      .insert({ user_id: user.id, challenge_id: challenge.id });
    if (!error) {
      await supabase.from('user_points').insert({ user_id: user.id, points: challenge.points, reason: 'daily_challenge' });
      setCompletedIds((prev) => new Set(prev).add(challenge.id));
    }
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <View style={st.statRow}>
        <View style={st.statCard}>
          <Stat label="Current streak" value={`${currentStreak}d`} />
        </View>
        <View style={st.statCard}>
          <Stat label="Longest streak" value={`${longestStreak}d`} />
        </View>
        <View style={st.statCard}>
          <Stat label="Badges" value={String(badges.length)} />
        </View>
      </View>

      <Text style={st.sectionTitle}>Daily challenges</Text>
      {challenges.length === 0 ? (
        <Text style={st.empty}>No challenges available yet.</Text>
      ) : (
        challenges.map((c) => {
          const done = completedIds.has(c.id);
          return (
            <View key={c.id} style={st.card}>
              <View style={st.cardHead}>
                <Text style={st.title}>{c.title}</Text>
                <Text style={st.points}>+{c.points}</Text>
              </View>
              {c.description ? <Text style={st.desc}>{c.description}</Text> : null}
              <TouchableOpacity
                style={[st.btn, done && st.btnDone]}
                onPress={() => complete(c)}
                disabled={done}
              >
                <Text style={st.btnText}>{done ? '✓ Completed' : 'Mark complete'}</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <Text style={st.sectionTitle}>Your badges</Text>
      {badges.length === 0 ? (
        <Text style={st.empty}>Earn badges by completing challenges and logging runs.</Text>
      ) : (
        <View style={st.badgeGrid}>
          {badges.map((b) => (
            <View key={b.badge_id} style={st.badge}>
              <Text style={st.badgeIcon}>{b.badge_icon ?? '🏅'}</Text>
              <Text style={st.badgeName} numberOfLines={2}>
                {b.badge_name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.screenX, paddingBottom: 40, gap: 14 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  points: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, paddingVertical: 11, alignItems: 'center' },
  btnDone: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badge: {
    width: '30%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  badgeIcon: { fontSize: 30 },
  badgeName: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
