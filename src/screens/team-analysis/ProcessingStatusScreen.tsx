import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { colors, radius, spacing } from '@/constants/theme';
import { useSubmitTeamVideo } from '@/services/supabase/useSubmitTeamVideo';

export function ProcessingStatusScreen() {
  const { analysisId, teamId } = useLocalSearchParams<{ analysisId: string; teamId: string }>();
  const { getAnalysis } = useSubmitTeamVideo();
  const [status, setStatus] = useState<'processing' | 'complete' | 'failed'>('processing');
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const row = await getAnalysis(analysisId);
      if (row?.status === 'complete') {
        setStatus('complete');
        if (timer.current) clearInterval(timer.current);
        router.replace({ pathname: '/team-analysis/report', params: { analysisId, teamId } });
      } else if (row?.status === 'failed') {
        setStatus('failed');
        setMessage(row?.result_json?.error ?? 'Analysis failed. Please try another clip.');
        if (timer.current) clearInterval(timer.current);
      } else if (attempts > 40) {
        // ~2 minutes — stop polling but leave the row processing.
        setStatus('failed');
        setMessage('This is taking longer than expected. Check back on the team screen shortly.');
        if (timer.current) clearInterval(timer.current);
      }
    };

    poll();
    timer.current = setInterval(poll, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  return (
    <View style={st.container}>
      {status === 'processing' ? (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={st.title}>Analyzing the run…</Text>
          <Text style={st.sub}>
            Our AI coach is breaking down the footage. This usually takes under a minute.
          </Text>
        </>
      ) : (
        <>
          <Text style={st.icon}>⚠️</Text>
          <Text style={st.title}>Couldn&apos;t finish</Text>
          <Text style={st.sub}>{message}</Text>
          <TouchableOpacity
            style={st.btn}
            onPress={() => router.replace({ pathname: '/team-analysis/[teamId]', params: { teamId } })}
          >
            <Text style={st.btnText}>Back to team</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.screenX, gap: 16 },
  icon: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
