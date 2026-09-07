import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PremiumGate } from '@/components/PremiumGate';
import { colors, spacing, radius, app } from '@/constants/theme';

type AnalysisResult = {
  overall_score?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  drills?: string[];
};

function AnalyzeInner() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const pickAndAnalyze = async () => {
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
    if (!asset || !user) return;

    try {
      setUploading(true);
      const ext = asset.uri.split('.').pop() ?? 'mp4';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const res = await fetch(asset.uri);
      const blob = await res.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(path, blob, { contentType: `video/${ext}`, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('videos').getPublicUrl(path);
      setUploading(false);

      setAnalyzing(true);
      const { data, error } = await supabase.functions.invoke('analyze-video', {
        body: { video_url: pub.publicUrl, user_id: user.id, event_type: app.eventType },
      });
      if (error) throw error;
      setResult(data as AnalysisResult);
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const busy = uploading || analyzing;

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.title}>AI Video Analysis</Text>
      <Text style={st.sub}>Upload a clip of your {app.eventLabel} run and get a breakdown.</Text>

      <TouchableOpacity style={[st.btn, busy && st.disabled]} onPress={pickAndAnalyze} disabled={busy}>
        {busy ? (
          <View style={st.busyRow}>
            <ActivityIndicator color="#fff" />
            <Text style={st.btnText}>{uploading ? 'Uploading…' : 'Analyzing…'}</Text>
          </View>
        ) : (
          <Text style={st.btnText}>Choose a video</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={st.result}>
          {typeof result.overall_score === 'number' && (
            <View style={st.scoreCard}>
              <Text style={st.scoreValue}>{result.overall_score}</Text>
              <Text style={st.scoreLabel}>Overall score</Text>
            </View>
          )}
          {result.summary ? <Text style={st.summary}>{result.summary}</Text> : null}

          {result.strengths && result.strengths.length > 0 && (
            <View style={st.block}>
              <Text style={st.blockTitle}>Strengths</Text>
              {result.strengths.map((item, i) => (
                <Text key={`str-${i}`} style={st.item}>• {item}</Text>
              ))}
            </View>
          )}
          {result.improvements && result.improvements.length > 0 && (
            <View style={st.block}>
              <Text style={st.blockTitle}>Areas to improve</Text>
              {result.improvements.map((item, i) => (
                <Text key={`imp-${i}`} style={st.item}>• {item}</Text>
              ))}
            </View>
          )}
          {result.drills && result.drills.length > 0 && (
            <View style={st.block}>
              <Text style={st.blockTitle}>Recommended drills</Text>
              {result.drills.map((item, i) => (
                <Text key={`drl-${i}`} style={st.item}>• {item}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

export default function AnalyzeScreen() {
  return (
    <PremiumGate featureName="AI video analysis">
      <AnalyzeInner />
    </PremiumGate>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { gap: 16, marginTop: 8 },
  scoreCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  scoreValue: { fontSize: 48, fontWeight: '800', color: colors.accent },
  scoreLabel: { fontSize: 14, color: colors.muted },
  summary: { fontSize: 15, color: colors.text, lineHeight: 22 },
  block: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 8, borderWidth: 1, borderColor: colors.border },
  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  item: { fontSize: 14, color: colors.muted, lineHeight: 21 },
});
