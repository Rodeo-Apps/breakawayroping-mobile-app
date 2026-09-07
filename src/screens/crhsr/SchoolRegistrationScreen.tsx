import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';

import { colors, radius, spacing } from '@/constants/theme';
import { useCrhsrSchools } from '@/services/supabase/useCrhsrSchools';
import { useRegisterSchool } from '@/services/supabase/useRegisterSchool';
import type { School } from '@/services/supabase/useCrhsr';

export function SchoolRegistrationScreen() {
  const [query, setQuery] = useState('');
  const { schools, loading } = useCrhsrSchools(query);
  const { register, submitting } = useRegisterSchool();

  const [selected, setSelected] = useState<School | null>(null);
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete');

  const onSubmit = async () => {
    if (!selected) {
      Alert.alert('Pick a school', 'Search and select your school first.');
      return;
    }
    const ok = await register({ schoolId: selected.id, role });
    if (ok) {
      Alert.alert(
        'Registered',
        role === 'coach'
          ? 'You are set up as a coach for this school.'
          : 'Your registration is pending verification by a school coach.',
      );
      router.back();
    } else {
      Alert.alert('Could not register', 'Please try again.');
    }
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>Register with a school</Text>

      <View style={st.field}>
        <Text style={st.label}>Search schools</Text>
        <TextInput
          style={st.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Type a school name…"
          placeholderTextColor={colors.muted}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        schools.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[st.schoolRow, selected?.id === s.id && st.schoolRowActive]}
            onPress={() => setSelected(s)}
          >
            <Text style={st.schoolName}>{s.name}</Text>
            <Text style={st.schoolMeta}>
              {[s.level === 'college' ? 'College' : 'High school', s.association, s.state]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <View style={st.field}>
        <Text style={st.label}>I am registering as</Text>
        <View style={st.chips}>
          {(['athlete', 'coach'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[st.chip, role === r && st.chipActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[st.chipText, role === r && st.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[st.saveBtn, submitting && st.disabled]} onPress={onSubmit} disabled={submitting}>
        <Text style={st.saveBtnText}>{submitting ? 'Submitting…' : 'Submit registration'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  field: { gap: 6 },
  label: { fontSize: 14, color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  },
  schoolRow: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  schoolRowActive: { borderColor: colors.accent },
  schoolName: { fontSize: 15, fontWeight: '600', color: colors.text },
  schoolMeta: { fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 14, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
