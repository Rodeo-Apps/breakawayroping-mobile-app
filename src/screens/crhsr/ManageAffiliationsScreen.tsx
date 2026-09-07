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
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolRoster } from '@/services/supabase/useSchoolRoster';
import { useRegisterSchool } from '@/services/supabase/useRegisterSchool';

export function ManageAffiliationsScreen() {
  const { profile } = useAuth();
  const { school, roster, loading, error, refetch } = useSchoolRoster(profile?.school_id ?? undefined);
  const { setAffiliationStatus, submitting } = useRegisterSchool();
  const [refreshing, setRefreshing] = useState(false);

  const verified = roster.filter((r) => r.status === 'verified');
  const pending = roster.filter((r) => r.status === 'pending');

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const remove = async (id: string) => {
    const ok = await setAffiliationStatus(id, 'withdrawn');
    if (ok) refetch();
  };

  if (!profile?.school_id) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="No school linked" body="Register as a coach for a school to manage a team." />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={st.title}>Manage my team</Text>
      {school ? (
        <TouchableOpacity onPress={() => router.push(`/crhsr/${school.id}`)}>
          <Text style={st.sub}>{school.name} — view public profile ›</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState title="Could not load" body={error} actionLabel="Retry" onAction={refetch} />
      ) : (
        <>
          {pending.length > 0 ? (
            <View style={st.pendingBanner}>
              <Text style={st.pendingText}>
                {pending.length} athlete{pending.length === 1 ? '' : 's'} awaiting verification
              </Text>
              <TouchableOpacity onPress={() => router.push('/crhsr/verify')}>
                <Text style={st.link}>Review ›</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={st.sectionTitle}>Verified roster ({verified.length})</Text>
          {verified.length === 0 ? (
            <Text style={st.muted}>No verified athletes yet.</Text>
          ) : (
            verified.map((a, i) => (
              <View key={a.id} style={st.row}>
                <Text style={st.rank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{a.name}</Text>
                  <Text style={st.meta}>
                    {a.role} · {a.season_points} pts
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(a.id)} disabled={submitting}>
                  <Text style={st.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
  muted: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rank: { fontSize: 14, fontWeight: '700', color: colors.accent, width: 24 },
  name: { fontSize: 15, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.muted },
  remove: { fontSize: 13, color: colors.danger, fontWeight: '600' },
});
