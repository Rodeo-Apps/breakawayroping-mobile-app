import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PremiumGate } from '@/components/PremiumGate';
import { prepareVideo } from '@/lib/videoFrames';
import { colors, spacing, radius, app } from '@/constants/theme';

// ---- Result shapes -------------------------------------------------------
type Criterion = { rating?: string; score?: number; notes?: string };
type IndividualResult = {
  overall_score?: number;
  summary?: string;
  legal_catch?: boolean;
  barrier_broken?: boolean;
  estimated_time_seconds?: number;
  criteria?: Record<string, Criterion>;
  strengths?: string[];
  improvements?: string[];
  drills?: string[];
};
type CommonFault = { fault: string; count: number; athletes?: string[]; coaching_note?: string };
type AggregateResult = {
  team_summary?: string;
  run_count?: number;
  common_faults?: CommonFault[];
  priorities?: string[];
  recommended_drills?: string[];
  per_athlete?: {
    athlete: string;
    overall_score?: number | null;
    legal_catch?: boolean | null;
    barrier_broken?: boolean | null;
    summary?: string | null;
  }[];
};

const CRITERIA_LABELS: Record<string, string> = {
  barrier_work: 'Barrier work',
  horse_positioning: 'Horse positioning & rate',
  loop_delivery: 'Loop delivery',
  catch_zone: 'Catch zone (neck only)',
  rope_management: 'Rope & slack management',
  string_release: 'String release off horn',
  timing: 'Timing / rhythm',
};

const CRITERIA_ORDER = [
  'barrier_work',
  'horse_positioning',
  'loop_delivery',
  'catch_zone',
  'rope_management',
  'string_release',
  'timing',
];

function ratingColor(rating?: string): string {
  switch (rating) {
    case 'excellent':
    case 'good':
      return '#2e7d32';
    case 'fair':
      return '#ed6c02';
    case 'poor':
      return '#c62828';
    default:
      return colors.muted;
  }
}

function AnalyzeInner() {
  const { user, profile } = useAuth();
  const isCoach = !!profile?.is_coach;

  const [mode, setMode] = useState<'individual' | 'coach'>('individual');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');

  const [individual, setIndividual] = useState<IndividualResult | null>(null);
  const [aggregate, setAggregate] = useState<AggregateResult | null>(null);

  // Coach: resolve (or lazily create) a team to attach the batch to.
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'coach' || !user || !isCoach) return;
    (async () => {
      const { data } = await supabase
        .from('coaching_teams')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (data && data[0]) setTeamId(data[0].id as string);
    })();
  }, [mode, user, isCoach]);

  async function ensureTeam(): Promise<string | null> {
    if (teamId) return teamId;
    if (!user) return null;
    const { data, error } = await supabase
      .from('coaching_teams')
      .insert({ name: 'My Team', owner_id: user.id })
      .select('id')
      .single();
    if (error) {
      Alert.alert('Team error', error.message);
      return null;
    }
    setTeamId(data.id as string);
    return data.id as string;
  }

  // ---- Individual mode: 1 video -> personal critique --------------------
  async function runIndividual() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your videos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset || !user) return;

    setIndividual(null);
    setBusy(true);
    try {
      setStatusText('Extracting frames & uploading…');
      const { videoUrl, frameUrls, frameTimesMs } = await prepareVideo(user.id, asset.uri);

      setStatusText('Analyzing run…');
      const { data, error } = await supabase.functions.invoke('analyze-video', {
        body: {
          video_url: videoUrl,
          frame_urls: frameUrls,
          frame_times_ms: frameTimesMs,
          user_id: user.id,
          event_type: app.eventType,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setIndividual(data as IndividualResult);
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again');
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }

  // ---- Coach mode: up to 15 videos -> aggregate team report -------------
  async function runCoach() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your videos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 15,
    });
    const assets = picked.canceled ? [] : picked.assets;
    if (!assets.length || !user) return;
    if (assets.length > 15) {
      Alert.alert('Too many videos', 'Coach mode analyzes up to 15 runs at a time.');
      return;
    }

    setAggregate(null);
    setBusy(true);
    try {
      const team = await ensureTeam();
      if (!team) throw new Error('Could not resolve a coaching team.');

      // Create the batch row up front so it tracks state.
      const { data: batch, error: batchErr } = await supabase
        .from('team_video_batches')
        .insert({
          team_id: team,
          coach_id: user.id,
          event_type: app.eventType,
          video_count: assets.length,
          status: 'processing',
        })
        .select('id')
        .single();
      if (batchErr) throw batchErr;

      const videos: { label: string; video_url: string; frame_urls: string[] }[] = [];
      let idx = 0;
      for (const asset of assets) {
        idx++;
        setStatusText(`Preparing run ${idx} of ${assets.length}…`);
        const { videoUrl, frameUrls } = await prepareVideo(user.id, asset.uri);
        videos.push({ label: `Rider ${idx}`, video_url: videoUrl, frame_urls: frameUrls });
      }

      setStatusText('Analyzing squad & building aggregate report…');
      const { data, error } = await supabase.functions.invoke('analyze-team-video', {
        body: {
          batch_id: batch.id,
          team_id: team,
          coach_id: user.id,
          event_type: app.eventType,
          videos,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAggregate(data as AggregateResult);
    } catch (e: any) {
      Alert.alert('Team analysis failed', e?.message ?? 'Please try again');
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>AI Video Analysis</Text>
      <Text style={st.sub}>
        Film from the stands and get a breakaway-roping breakdown judged on barrier work,
        horse rate, loop delivery, catch, rope handling, string release, and timing.
      </Text>

      {isCoach && (
        <View style={st.toggle}>
          <TouchableOpacity
            style={[st.toggleBtn, mode === 'individual' && st.toggleBtnActive]}
            onPress={() => setMode('individual')}
            disabled={busy}
          >
            <Text style={[st.toggleText, mode === 'individual' && st.toggleTextActive]}>Individual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.toggleBtn, mode === 'coach' && st.toggleBtnActive]}
            onPress={() => setMode('coach')}
            disabled={busy}
          >
            <Text style={[st.toggleText, mode === 'coach' && st.toggleTextActive]}>Coach (team)</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[st.btn, busy && st.disabled]}
        onPress={mode === 'coach' ? runCoach : runIndividual}
        disabled={busy}
      >
        {busy ? (
          <View style={st.busyRow}>
            <ActivityIndicator color="#fff" />
            <Text style={st.btnText}>{statusText || 'Working…'}</Text>
          </View>
        ) : (
          <Text style={st.btnText}>
            {mode === 'coach' ? 'Choose up to 15 runs' : 'Choose a video'}
          </Text>
        )}
      </TouchableOpacity>

      {mode === 'individual' && individual && <IndividualView r={individual} />}
      {mode === 'coach' && aggregate && <AggregateView r={aggregate} />}
    </ScrollView>
  );
}

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[st.badge, { backgroundColor: ok ? '#2e7d32' : '#c62828' }]}>
      <Text style={st.badgeText}>{label}</Text>
    </View>
  );
}

function IndividualView({ r }: { r: IndividualResult }) {
  return (
    <View style={st.result}>
      {typeof r.overall_score === 'number' && (
        <View style={st.scoreCard}>
          <Text style={st.scoreValue}>{Math.round(r.overall_score)}</Text>
          <Text style={st.scoreLabel}>Overall score</Text>
        </View>
      )}

      <View style={st.badgeRow}>
        {typeof r.legal_catch === 'boolean' && (
          <Badge label={r.legal_catch ? 'Legal catch' : 'Illegal / no catch'} ok={r.legal_catch} />
        )}
        {typeof r.barrier_broken === 'boolean' && (
          <Badge label={r.barrier_broken ? 'Barrier broken' : 'Barrier clean'} ok={!r.barrier_broken} />
        )}
        {typeof r.estimated_time_seconds === 'number' && r.estimated_time_seconds >= 0 && (
          <View style={[st.badge, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Text style={[st.badgeText, { color: colors.text }]}>~{r.estimated_time_seconds.toFixed(1)}s</Text>
          </View>
        )}
      </View>

      {r.summary ? <Text style={st.summary}>{r.summary}</Text> : null}

      {r.criteria && (
        <View style={st.block}>
          <Text style={st.blockTitle}>Judging breakdown</Text>
          {CRITERIA_ORDER.map((k) => {
            const c = r.criteria?.[k];
            if (!c) return null;
            return (
              <View key={k} style={st.critRow}>
                <View style={st.critHeader}>
                  <Text style={st.critLabel}>{CRITERIA_LABELS[k] ?? k}</Text>
                  <Text style={[st.critRating, { color: ratingColor(c.rating) }]}>
                    {typeof c.score === 'number' ? `${Math.round(c.score)} · ` : ''}
                    {c.rating ?? ''}
                  </Text>
                </View>
                {c.notes ? <Text style={st.item}>{c.notes}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      <ListBlock title="Strengths" items={r.strengths} />
      <ListBlock title="Areas to improve" items={r.improvements} />
      <ListBlock title="Recommended drills" items={r.drills} />
    </View>
  );
}

function AggregateView({ r }: { r: AggregateResult }) {
  return (
    <View style={st.result}>
      <View style={st.block}>
        <Text style={st.blockTitle}>Team report{typeof r.run_count === 'number' ? ` · ${r.run_count} runs` : ''}</Text>
        {r.team_summary ? <Text style={st.summary}>{r.team_summary}</Text> : null}
      </View>

      {r.common_faults && r.common_faults.length > 0 && (
        <View style={st.block}>
          <Text style={st.blockTitle}>Common faults across the squad</Text>
          {r.common_faults.map((f, i) => (
            <View key={`f-${i}`} style={st.critRow}>
              <View style={st.critHeader}>
                <Text style={st.critLabel}>{f.fault}</Text>
                <Text style={[st.critRating, { color: '#c62828' }]}>{f.count} rider{f.count === 1 ? '' : 's'}</Text>
              </View>
              {f.athletes && f.athletes.length > 0 ? (
                <Text style={st.item}>{f.athletes.join(', ')}</Text>
              ) : null}
              {f.coaching_note ? <Text style={st.item}>{f.coaching_note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <ListBlock title="Priorities to fix first" items={r.priorities} />
      <ListBlock title="Recommended group drills" items={r.recommended_drills} />

      {r.per_athlete && r.per_athlete.length > 0 && (
        <View style={st.block}>
          <Text style={st.blockTitle}>Per-rider</Text>
          {r.per_athlete.map((a, i) => (
            <View key={`a-${i}`} style={st.critRow}>
              <View style={st.critHeader}>
                <Text style={st.critLabel}>{a.athlete}</Text>
                <Text style={st.critRating}>
                  {typeof a.overall_score === 'number' ? Math.round(a.overall_score) : '—'}
                </Text>
              </View>
              {a.summary ? <Text style={st.item}>{a.summary}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={st.block}>
      <Text style={st.blockTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={`${title}-${i}`} style={st.item}>• {item}</Text>
      ))}
    </View>
  );
}

export function AnalyzeScreen() {
  return (
    <PremiumGate featureName="AI video analysis">
      <AnalyzeInner />
    </PremiumGate>
  );
}

export default AnalyzeScreen;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  toggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.control, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.control - 2 },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.muted, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { gap: 16, marginTop: 8 },
  scoreCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  scoreValue: { fontSize: 48, fontWeight: '800', color: colors.accent },
  scoreLabel: { fontSize: 14, color: colors.muted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  summary: { fontSize: 15, color: colors.text, lineHeight: 22 },
  block: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 8, borderWidth: 1, borderColor: colors.border },
  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  item: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  critRow: { gap: 4, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  critHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  critRating: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
});
