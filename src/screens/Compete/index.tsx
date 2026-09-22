import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';
import { scoreBreakawayRun, loadRulesProfile, formatTime } from '@/lib/scoring';

// Breakaway roping is a WPRA-sanctioned event; resolve WPRA rules for the run.
const ASSOCIATION_CODE = 'WPRA';
const EVENT_TYPE = 'breakaway';

type Run = {
  id: string;
  created_at: string;
  raw_time_ms: number | null;
  official_time_ms: number | null;
  total_time: number | string | null;
  barrier_broken: boolean | null;
  catch_ok: boolean | null;
  status: string | null;
  notes: string | null;
};

export function CompeteScreen() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [time_seconds, set_time_seconds] = useState('');
  const [caught, set_caught] = useState(true);
  const [barrier_broken, set_barrier_broken] = useState(false);
  const [broke_by_hand, set_broke_by_hand] = useState(false);
  const [released_cleanly, set_released_cleanly] = useState(true);
  const [notes, set_notes] = useState('');

  const loadRuns = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('breakaway_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setRuns((data as Run[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const resetForm = () => {
    set_time_seconds('');
    set_caught(true);
    set_barrier_broken(false);
    set_broke_by_hand(false);
    set_released_cleanly(true);
    set_notes('');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Raw time comes in as seconds from the stopwatch; the engine and the
    // database both work in milliseconds.
    const rawTimeMs = time_seconds ? Math.round(Number(time_seconds) * 1000) : null;

    // Resolve the dated rules profile so the barrier penalty is real and citable.
    const profile = await loadRulesProfile(ASSOCIATION_CODE, EVENT_TYPE);
    if (!profile) {
      setSaving(false);
      Alert.alert(
        'No rule set',
        `No ${ASSOCIATION_CODE} rules are seeded for breakaway roping. Cannot score the run.`,
      );
      return;
    }

    let outcome;
    try {
      outcome = scoreBreakawayRun(
        {
          rawTimeMs,
          caught,
          stringBrokeAwayCleanly: released_cleanly,
          brokeStringByHand: broke_by_hand,
          barrierBroken: barrier_broken,
        },
        profile,
      );
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Could not score run', e?.message ?? 'Scoring engine error.');
      return;
    }

    const officialTimeMs = outcome.officialTimeMs ?? null;

    // Store BOTH the raw time and the penalty-adjusted official time. Stats and
    // rankings read official_time_ms; raw_time_ms is preserved for review.
    const payload = {
      user_id: user.id,
      raw_time_ms: rawTimeMs,
      official_time_ms: officialTimeMs,
      total_time: officialTimeMs != null ? Math.round(officialTimeMs) / 1000 : null,
      catch_ok: caught,
      barrier_broken,
      status: outcome.status,
      notes: notes || null,
    };
    const { error } = await supabase.from('breakaway_runs').insert(payload);
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    // Surface the ruling (with its citation) so the contestant sees the penalty.
    Alert.alert(
      officialTimeMs != null ? `${formatTime(officialTimeMs)}` : outcome.status.replace(/_/g, ' '),
      outcome.explanation,
    );
    resetForm();
    setShowForm(false);
    loadRuns();
  };

  return (
    <ScrollView style={cs.container} contentContainerStyle={cs.content}>
      <View style={cs.headerRow}>
        <Text style={cs.title}>Practice log</Text>
        <TouchableOpacity style={cs.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={cs.addBtnText}>{showForm ? 'Close' : '+ Log run'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={cs.sub}>
        Hand-timed breakaway roping runs stay yours — they are structurally separated from official results and never reach a
        leaderboard. Barrier penalties are applied automatically under the {ASSOCIATION_CODE} rule book.
      </Text>

      {showForm && (
        <View style={cs.form}>
        <View style={cs.field}>
          <Text style={cs.label}>Raw time (s)</Text>
          <TextInput
            style={cs.input}
            value={time_seconds}
            onChangeText={set_time_seconds}
            keyboardType={'numeric'}
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>Legal catch</Text>
          <Switch value={caught} onValueChange={set_caught} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>String released cleanly</Text>
          <Switch value={released_cleanly} onValueChange={set_released_cleanly} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>Broke string by hand</Text>
          <Switch value={broke_by_hand} onValueChange={set_broke_by_hand} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>Barrier broken (+ penalty)</Text>
          <Switch value={barrier_broken} onValueChange={set_barrier_broken} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.field}>
          <Text style={cs.label}>Notes</Text>
          <TextInput
            style={cs.input}
            value={notes}
            onChangeText={set_notes}
            placeholder=""
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>
          <TouchableOpacity style={[cs.saveBtn, saving && cs.disabled]} onPress={handleSave} disabled={saving}>
            <Text style={cs.saveBtnText}>{saving ? 'Saving…' : 'Save run'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {(() => {
        // Personal best is computed from OFFICIAL time (penalties included).
        const _vals = runs
          .map((r) => (r.official_time_ms != null ? r.official_time_ms / 1000 : Number(r.total_time)))
          .filter((n: number) => !Number.isNaN(n) && n > 0);
        if (!_vals.length) return null;
        const _best = Math.min(..._vals);
        return (
          <View style={cs.pbBanner}>
            <Text style={cs.pbLabel}>Personal best (official)</Text>
            <Text style={cs.pbValue}>{_best.toFixed(2)}s</Text>
          </View>
        );
      })()}

      <TouchableOpacity style={cs.analyzeBtn} onPress={() => router.push('/analyze')}>
        <Text style={cs.analyzeBtnText}>⭐ Analyze a video</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : runs.length === 0 ? (
        <Text style={cs.empty}>Nothing logged yet. Log your first breakaway roping run above.</Text>
      ) : (
        runs.map((run) => {
          const official =
            run.official_time_ms != null
              ? formatTime(run.official_time_ms)
              : run.total_time != null
                ? String(run.total_time)
                : '—';
          const raw = run.raw_time_ms != null ? formatTime(run.raw_time_ms) : null;
          const hasPenalty =
            run.barrier_broken &&
            run.raw_time_ms != null &&
            run.official_time_ms != null &&
            run.official_time_ms !== run.raw_time_ms;
          return (
            <View key={run.id} style={cs.runCard}>
              <Text style={cs.runPrimary}>
                {run.status === 'no_time' || run.status === 'dq' ? (run.status ?? '').replace(/_/g, ' ') : `${official}s`}
              </Text>
              {hasPenalty && raw ? (
                <Text style={cs.runPenalty}>raw {raw}s + barrier penalty</Text>
              ) : null}
              <Text style={cs.runDate}>{new Date(run.created_at).toLocaleDateString()}</Text>
              {run.notes ? <Text style={cs.runNotes}>{run.notes}</Text> : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  form: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 14, borderWidth: 1, borderColor: colors.border },
  field: { gap: 6 },
  label: { fontSize: 14, color: colors.text, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: 12, color: colors.text, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  analyzeBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.control, padding: 14, alignItems: 'center' },
  analyzeBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pbBanner: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, borderWidth: 1, borderColor: colors.accent, gap: 2 },
  pbLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  pbValue: { fontSize: 28, fontWeight: '800', color: colors.accent },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 14 },
  runCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 4, borderWidth: 1, borderColor: colors.border },
  runPrimary: { fontSize: 18, fontWeight: '700', color: colors.text },
  runPenalty: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  runDate: { fontSize: 12, color: colors.muted },
  runNotes: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
