import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

const CATEGORIES = ['horse', 'tack', 'trailer', 'service'] as const;

export function CreateListingScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('tack');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !description.trim() || !price.trim()) {
      Alert.alert('Missing info', 'Title, description, and price are required.');
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Enter a valid price.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('marketplace_listings').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      price: priceNum,
      location_city: city.trim() || null,
      location_state: state.trim() || null,
      status: 'active',
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not post', error.message);
      return;
    }
    router.back();
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.label}>Title</Text>
      <TextInput style={st.input} value={title} onChangeText={setTitle} placeholder="e.g. Breakaway rope, like new" placeholderTextColor={colors.muted} />

      <Text style={st.label}>Category</Text>
      <View style={st.chips}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[st.chip, category === c && st.chipActive]} onPress={() => setCategory(c)}>
            <Text style={[st.chipText, category === c && st.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.label}>Price (USD)</Text>
      <TextInput style={st.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric" />

      <Text style={st.label}>Description</Text>
      <TextInput
        style={[st.input, st.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the item, condition, and details…"
        placeholderTextColor={colors.muted}
        multiline
      />

      <View style={st.row}>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>City</Text>
          <TextInput style={st.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.muted} />
        </View>
        <View style={{ width: 100 }}>
          <Text style={st.label}>State</Text>
          <TextInput style={st.input} value={state} onChangeText={setState} placeholder="TX" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={2} />
        </View>
      </View>

      <TouchableOpacity style={[st.btn, saving && st.disabled]} onPress={submit} disabled={saving}>
        <Text style={st.btnText}>{saving ? 'Posting…' : 'Post listing'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 10, paddingBottom: 60 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
