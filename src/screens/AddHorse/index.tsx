import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';

import { colors, radius, spacing, app } from '@/constants/theme';
import { useAddHorse } from '@/services/supabase/useAddHorse';

const ROUGHSTOCK = ['saddlebronc', 'bareback', 'bullriding'];

export function AddHorseScreen() {
  const { addHorse, saving } = useAddHorse();
  const noun = ROUGHSTOCK.includes(app.eventType) ? 'animal' : 'horse';

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', `Give your ${noun} a name to save it.`);
      return;
    }
    const ok = await addHorse({ name, breed, age, color, notes });
    if (ok) {
      router.back();
    } else {
      Alert.alert('Could not save', `Something went wrong saving this ${noun}. Please try again.`);
    }
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>Add a {noun}</Text>

      <Field label="Name" value={name} onChangeText={setName} placeholder={`Your ${noun}'s name`} />
      <Field label="Breed" value={breed} onChangeText={setBreed} placeholder="e.g. Quarter Horse" />
      <Field label="Age (years)" value={age} onChangeText={setAge} placeholder="e.g. 8" keyboardType="numeric" />
      <Field label="Color" value={color} onChangeText={setColor} placeholder="e.g. Bay" />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Temperament, feed, quirks…" multiline />

      <TouchableOpacity style={[st.saveBtn, saving && st.disabled]} onPress={onSave} disabled={saving}>
        <Text style={st.saveBtnText}>{saving ? 'Saving…' : `Save ${noun}`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  multiline,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, multiline && st.inputMultiline]}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
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
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
