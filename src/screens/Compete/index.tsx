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

type Run = {
  id: string;
  created_at: string;
  time_seconds: number | string | null;
  notes: string | null;
};

export function CompeteScreen() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [time_seconds, set_time_seconds] = useState('');
  const [catch_type, set_catch_type] = useState('clean');
  const [barrier_broken, set_barrier_broken] = useState(false);
  const [flag_dropped, set_flag_dropped] = useState(false);
  const [horse_name, set_horse_name] = useState('');
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
    set_catch_type('clean');
    set_barrier_broken(false);
    set_flag_dropped(false);
    set_horse_name('');
    set_notes('');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      time_seconds: time_seconds ? Number(time_seconds) : null,
      catch_type,
      barrier_broken,
      flag_dropped,
      horse_name: horse_name || null,
      notes: notes || null,
    };
    const { error } = await supabase.from('breakaway_runs').insert(payload);
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
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
        leaderboard.
      </Text>

      {showForm && (
        <View style={cs.form}>
        <View style={cs.field}>
          <Text style={cs.label}>Time (s)</Text>
          <TextInput
            style={cs.input}
            value={time_seconds}
            onChangeText={set_time_seconds}
            keyboardType={'numeric'}
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={cs.field}>
          <Text style={cs.label}>Catch type</Text>
          <View style={cs.chips}>
            {(['clean', 'barrier_penalty', 'no_catch'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[cs.chip, catch_type === opt && cs.chipActive]}
                onPress={() => set_catch_type(opt)}
              >
                <Text style={[cs.chipText, catch_type === opt && cs.chipTextActive]}>{opt.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>Barrier broken</Text>
          <Switch value={barrier_broken} onValueChange={set_barrier_broken} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.toggleRow}>
          <Text style={cs.label}>Flag dropped</Text>
          <Switch value={flag_dropped} onValueChange={set_flag_dropped} trackColor={{ true: colors.accent }} />
        </View>
        <View style={cs.field}>
          <Text style={cs.label}>Horse name</Text>
          <TextInput
            style={cs.input}
            value={horse_name}
            onChangeText={set_horse_name}
            placeholder=""
            placeholderTextColor={colors.muted}
          />
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
        const _vals = runs
          .map((r: any) => Number(r.time_seconds))
          .filter((n: number) => !Number.isNaN(n) && n > 0);
        if (!_vals.length) return null;
        const _best = Math.min(..._vals);
        return (
          <View style={cs.pbBanner}>
            <Text style={cs.pbLabel}>Personal best</Text>
            <Text style={cs.pbValue}>{_best}s</Text>
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
        runs.map((run) => (
          <View key={run.id} style={cs.runCard}>
            <Text style={cs.runPrimary}>{String(run.time_seconds ?? '—')}</Text>
            <Text style={cs.runDate}>{new Date(run.created_at).toLocaleDateString()}</Text>
            {run.notes ? <Text style={cs.runNotes}>{run.notes}</Text> : null}
          </View>
        ))
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
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
  runDate: { fontSize: 12, color: colors.muted },
  runNotes: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
