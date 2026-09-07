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
import { useAuth } from '@/contexts/AuthContext';
import { useCrhsr } from '@/services/supabase/useCrhsr';

export function CrhsrIndexScreen() {
  const { profile } = useAuth();
  const { affiliation, standings, loading, error, refetch } = useCrhsr();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const statusText =
    affiliation?.status === 'verified'
      ? 'Verified'
      : affiliation?.status === 'pending'
        ? 'Pending verification'
        : 'Not registered';

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={st.title}>College & High School Rodeo</Text>
      <Text style={st.sub}>Register with your school, track standings, and manage your team.</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState title="Could not load" body={error} actionLabel="Retry" onAction={refetch} />
      ) : affiliation ? (
        <View style={st.card}>
          <Text style={st.schoolName}>{affiliation.school?.name ?? 'Your school'}</Text>
          <Text style={st.cardMeta}>
            {[affiliation.school?.association, affiliation.school?.region, affiliation.school?.state]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={st.rowBetween}>
            <Text style={st.cardMeta}>Role: {affiliation.role}</Text>
            <View style={[st.badge, affiliation.status === 'verified' ? st.badgeOk : st.badgePending]}>
              <Text style={st.badgeText}>{statusText}</Text>
            </View>
          </View>
          <Text style={st.points}>{affiliation.season_points} season points</Text>
          {affiliation.school ? (
            <TouchableOpacity onPress={() => router.push(`/crhsr/${affiliation.school!.id}`)}>
              <Text style={st.link}>View school profile ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title="Not registered yet"
          body={`Register with your ${app.associations.includes('NIRA') ? 'college or high school' : 'school'} rodeo program to appear in standings.`}
          actionLabel="Register with a school"
          onAction={() => router.push('/crhsr/register')}
        />
      )}

      {/* Actions */}
      <View style={st.actions}>
        <TouchableOpacity style={st.actionBtn} onPress={() => router.push('/crhsr/register')}>
          <Text style={st.actionText}>Register / change school</Text>
        </TouchableOpacity>
        {profile?.is_coach ? (
          <>
            <TouchableOpacity style={st.actionBtn} onPress={() => router.push('/crhsr/verify')}>
              <Text style={st.actionText}>Verify athletes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.actionBtn} onPress={() => router.push('/crhsr/manage')}>
              <Text style={st.actionText}>Manage my team</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {standings.length > 0 ? (
        <View>
          <Text style={st.sectionTitle}>Team standings</Text>
          {standings.map((s, i) => (
            <View key={s.id} style={st.standRow}>
              <Text style={st.standRank}>{i + 1}</Text>
              <Text style={st.standName}>{s.name ?? 'Athlete'}</Text>
              <Text style={st.standPts}>{s.season_points} pts</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  schoolName: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeOk: { backgroundColor: colors.success },
  badgePending: { backgroundColor: colors.warning },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  points: { fontSize: 15, fontWeight: '600', color: colors.accent },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, marginTop: 4 },
  actions: { gap: 10 },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 14,
    backgroundColor: colors.surface,
  },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  standRank: { fontSize: 14, fontWeight: '700', color: colors.accent, width: 24 },
  standName: { fontSize: 15, color: colors.text, flex: 1 },
  standPts: { fontSize: 14, color: colors.muted, fontWeight: '600' },
});
