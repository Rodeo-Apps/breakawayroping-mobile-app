import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { pickImage, uploadImage, type PickedImage } from '@/utils/imageUpload';
import { colors, radius, spacing } from '@/constants/theme';

const MAX_PHOTOS = 5;

const CATEGORIES = ['horse', 'tack', 'trailer', 'service'] as const;

export function CreateListingScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('tack');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [saving, setSaving] = useState(false);

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const img = await pickImage();
    if (img) setPhotos((prev) => [...prev, img]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

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
    const { data: created, error } = await supabase
      .from('marketplace_listings')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        price: priceNum,
        location_city: city.trim() || null,
        location_state: state.trim() || null,
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !created) {
      setSaving(false);
      Alert.alert('Could not post', error?.message ?? 'Please try again.');
      return;
    }

    // Upload photos to the listing-photos bucket and record them. A photo upload
    // failure does not block the listing — it is already created at this point.
    const listingId = (created as { id: string }).id;
    try {
      let sortOrder = 0;
      for (const photo of photos) {
        const url = await uploadImage('listing-photos', user.id, photo);
        await supabase
          .from('listing_photos')
          .insert({ listing_id: listingId, photo_url: url, sort_order: sortOrder });
        sortOrder += 1;
      }
    } catch (e: any) {
      Alert.alert('Listing posted', 'The listing was created, but some photos failed to upload.');
    }

    setSaving(false);
    router.back();
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.label}>Title</Text>
      <TextInput style={st.input} value={title} onChangeText={setTitle} placeholder="e.g. Breakaway rope, like new" placeholderTextColor={colors.muted} />

      <Text style={st.label}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
      <View style={st.photoRow}>
        {photos.map((p) => (
          <TouchableOpacity key={p.uri} onPress={() => removePhoto(p.uri)} style={st.photoWrap}>
            <Image source={{ uri: p.uri }} style={st.photo} />
            <View style={st.photoRemove}>
              <Text style={st.photoRemoveText}>×</Text>
            </View>
          </TouchableOpacity>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <TouchableOpacity style={st.addPhoto} onPress={addPhoto}>
            <Text style={st.addPhotoText}>+ Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: radius.control, backgroundColor: colors.surface },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 17 },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
