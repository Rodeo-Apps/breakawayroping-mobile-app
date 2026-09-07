import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useSubmitTeamVideo } from '@/services/supabase/useSubmitTeamVideo';

type Report = {
  overall_score?: number;
  summary?: string;
  phases?: Record<string, unknown>;
  strengths?: string[];
  improvements?: string[];
  drills?: string[];
  coaching_cues?: string[];
};

function Block({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={st.block}>
      <Text style={st.blockTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={`${title}-${i}`} style={st.item}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

export function TeamReportScreen() {
  const { analysisId } = useLocalSearchParams<{ analysisId: string }>();
  const { getAnalysis } = useSubmitTeamVideo();
  const [report, setReport] = useState<Report | null>(null);
  const [athlete, setAthlete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!analysisId) return;
      const row = await getAnalysis(analysisId);
      setReport((row?.result_json as Report) ?? null);
      setAthlete(row?.athlete_name ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!report) {
    return (
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <EmptyState title="No report" body="This review has no results yet." />
      </ScrollView>
    );
  }

  const phaseEntries = report.phases ? Object.entries(report.phases) : [];

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>{athlete ? `${athlete}'s run` : 'Run review'}</Text>

      {typeof report.overall_score === 'number' ? (
        <View style={st.scoreCard}>
          <Text style={st.scoreValue}>{report.overall_score}</Text>
          <Text style={st.scoreLabel}>Overall score</Text>
        </View>
      ) : null}

      {report.summary ? <Text style={st.summary}>{report.summary}</Text> : null}

      <Block title="Coaching cues" items={report.coaching_cues} />
      <Block title="Strengths" items={report.strengths} />
      <Block title="Areas to improve" items={report.improvements} />
      <Block title="Recommended drills" items={report.drills} />

      {phaseEntries.length > 0 ? (
        <View style={st.block}>
          <Text style={st.blockTitle}>Phase breakdown</Text>
          {phaseEntries.map(([phase, detail]) => (
            <View key={phase} style={st.phase}>
              <Text style={st.phaseName}>{phase.replace(/_/g, ' ')}</Text>
              <Text style={st.item}>{typeof detail === 'string' ? detail : JSON.stringify(detail)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  scoreCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  scoreValue: { fontSize: 48, fontWeight: '800', color: colors.accent },
  scoreLabel: { fontSize: 14, color: colors.muted },
  summary: { fontSize: 15, color: colors.text, lineHeight: 22 },
  block: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 8, borderWidth: 1, borderColor: colors.border },
  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  item: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  phase: { gap: 2, marginTop: 4 },
  phaseName: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
});
