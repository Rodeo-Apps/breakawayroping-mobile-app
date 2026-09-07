import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useTeamDetail } from '@/services/supabase/useTeamDetail';

function statusColor(status: string): string {
  if (status === 'complete') return colors.success;
  if (status === 'failed') return colors.danger;
  return colors.warning;
}

export function TeamDetailScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { team, members, analyses, loading, error, refetch } = useTeamDetail(teamId);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !team) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="Team not found" body={error ?? 'This team may have been removed.'} actionLabel="Retry" onAction={refetch} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>{team.name}</Text>

      <TouchableOpacity
        style={st.primaryBtn}
        onPress={() => router.push({ pathname: '/team-analysis/new-review', params: { teamId: team.id } })}
      >
        <Text style={st.primaryBtnText}>+ Submit a video for review</Text>
      </TouchableOpacity>

      <Text style={st.sectionTitle}>Roster</Text>
      {members.length === 0 ? (
        <Text style={st.muted}>No athletes on this team yet.</Text>
      ) : (
        members.map((m) => (
          <View key={m.id} style={st.rowCard}>
            <Text style={st.rowName}>{m.name}</Text>
            <Text style={st.rowMeta}>{m.role}</Text>
          </View>
        ))
      )}

      <Text style={st.sectionTitle}>Video reviews</Text>
      {analyses.length === 0 ? (
        <Text style={st.muted}>No reviews yet. Submit a video to get AI coaching feedback.</Text>
      ) : (
        analyses.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={st.rowCard}
            disabled={a.status !== 'complete'}
            onPress={() =>
              router.push({ pathname: '/team-analysis/report', params: { analysisId: a.id, teamId: team.id } })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={st.rowName}>{a.athlete_name ?? 'Athlete run'}</Text>
              <Text style={st.rowMeta}>{new Date(a.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={[st.badge, { borderColor: statusColor(a.status) }]}>
              <Text style={[st.badgeText, { color: statusColor(a.status) }]}>{a.status}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.muted },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
