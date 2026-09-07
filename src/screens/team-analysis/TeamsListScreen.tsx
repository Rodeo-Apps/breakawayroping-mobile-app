import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/constants/theme';
import { useTeams } from '@/services/supabase/useTeams';
import { PremiumCoachGate } from './components/PremiumCoachGate';

function TeamsListInner() {
  const { teams, loading, error, refetch, createTeam } = useTeams();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const ok = await createTeam(name);
    setCreating(false);
    if (ok) {
      setName('');
      setShowForm(false);
    } else {
      Alert.alert('Could not create team', 'Please try again.');
    }
  };

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={st.headerRow}>
        <Text style={st.title}>Team Analysis</Text>
        <TouchableOpacity style={st.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={st.addBtnText}>{showForm ? 'Close' : '+ New team'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={st.sub}>Review your roster&apos;s runs with AI coaching cues.</Text>

      {showForm ? (
        <View style={st.form}>
          <TextInput
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder="Team name"
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity style={[st.saveBtn, creating && st.disabled]} onPress={onCreate} disabled={creating}>
            <Text style={st.saveBtnText}>{creating ? 'Creating…' : 'Create team'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState title="Could not load teams" body={error} actionLabel="Retry" onAction={refetch} />
      ) : teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          body="Create a team to start reviewing your athletes' runs together."
          actionLabel="Create a team"
          onAction={() => setShowForm(true)}
        />
      ) : (
        teams.map((t) => (
          <TouchableOpacity key={t.id} style={st.card} onPress={() => router.push(`/team-analysis/${t.id}`)}>
            <Text style={st.cardTitle}>{t.name}</Text>
            <Text style={st.cardMeta}>
              {t.member_count} member{t.member_count === 1 ? '' : 's'} · {t.role}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

export function TeamsListScreen() {
  return (
    <PremiumCoachGate>
      <TeamsListInner />
    </PremiumCoachGate>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
});
