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
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { colors, radius, spacing, app } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSubmitTeamVideo } from '@/services/supabase/useSubmitTeamVideo';

export function NewVideoReviewScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { user } = useAuth();
  const { submit } = useSubmitTeamVideo();

  const [athleteName, setAthleteName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = uploading || submitting;

  const pickAndSubmit = async () => {
    if (!teamId || !user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your videos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (picked.canceled || !picked.assets.length) return;
    const asset = picked.assets[0];
    if (!asset) return;

    try {
      setUploading(true);
      const ext = asset.uri.split('.').pop() ?? 'mp4';
      const path = `${user.id}/team/${Date.now()}.${ext}`;
      const res = await fetch(asset.uri);
      const blob = await res.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(path, blob, { contentType: `video/${ext}`, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('videos').getPublicUrl(path);
      setUploading(false);

      setSubmitting(true);
      const analysisId = await submit({
        teamId,
        videoUrl: pub.publicUrl,
        athleteName: athleteName.trim() || undefined,
      });
      setSubmitting(false);
      if (!analysisId) {
        Alert.alert('Could not submit', 'Please try again.');
        return;
      }
      router.replace({ pathname: '/team-analysis/processing', params: { analysisId, teamId } });
    } catch (e: any) {
      setUploading(false);
      setSubmitting(false);
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    }
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>Submit a run for review</Text>
      <Text style={st.sub}>
        Upload a clip of your athlete&apos;s {app.eventLabel} run. The team gets an AI breakdown with
        coaching cues.
      </Text>

      <View style={st.field}>
        <Text style={st.label}>Athlete name (optional)</Text>
        <TextInput
          style={st.input}
          value={athleteName}
          onChangeText={setAthleteName}
          placeholder="Who is in this clip?"
          placeholderTextColor={colors.muted}
        />
      </View>

      <TouchableOpacity style={[st.btn, busy && st.disabled]} onPress={pickAndSubmit} disabled={busy}>
        {busy ? (
          <View style={st.busyRow}>
            <ActivityIndicator color="#fff" />
            <Text style={st.btnText}>{uploading ? 'Uploading…' : 'Submitting…'}</Text>
          </View>
        ) : (
          <Text style={st.btnText}>Choose a video</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22 },
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
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
