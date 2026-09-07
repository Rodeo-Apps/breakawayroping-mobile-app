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

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolRoster } from '@/services/supabase/useSchoolRoster';
import { useRegisterSchool } from '@/services/supabase/useRegisterSchool';

export function CoachVerificationScreen() {
  const { profile } = useAuth();
  const { school, roster, loading, error, refetch } = useSchoolRoster(profile?.school_id ?? undefined);
  const { setAffiliationStatus, submitting } = useRegisterSchool();
  const [refreshing, setRefreshing] = useState(false);

  const pending = roster.filter((r) => r.status === 'pending');

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const act = async (id: string, status: 'verified' | 'withdrawn') => {
    const ok = await setAffiliationStatus(id, status);
    if (ok) refetch();
  };

  if (!profile?.school_id) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState
          title="No school linked"
          body="Register as a coach for a school first to verify athletes."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={st.title}>Verify athletes</Text>
      {school ? <Text style={st.sub}>{school.name}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState title="Could not load" body={error} actionLabel="Retry" onAction={refetch} />
      ) : pending.length === 0 ? (
        <EmptyState title="Nothing pending" body="There are no athletes awaiting verification right now." />
      ) : (
        pending.map((a) => (
          <View key={a.id} style={st.card}>
            <Text style={st.name}>{a.name}</Text>
            <Text style={st.meta}>Requested {new Date(a.created_at).toLocaleDateString()}</Text>
            <View style={st.btnRow}>
              <TouchableOpacity
                style={[st.btn, st.approve, submitting && st.disabled]}
                onPress={() => act(a.id, 'verified')}
                disabled={submitting}
              >
                <Text style={st.btnText}>Verify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.btn, st.reject, submitting && st.disabled]}
                onPress={() => act(a.id, 'withdrawn')}
                disabled={submitting}
              >
                <Text style={[st.btnText, { color: colors.danger }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, borderRadius: radius.control, padding: 12, alignItems: 'center', borderWidth: 1 },
  approve: { backgroundColor: colors.accent, borderColor: colors.accent },
  reject: { backgroundColor: colors.surface, borderColor: colors.danger },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.6 },
});
