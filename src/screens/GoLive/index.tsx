import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, app } from '@/constants/theme';

// Go Live, ported from BarrelConnect. Lists active `live_sessions` and lets the
// user start / end their own broadcast. Streaming transport is device-side; this
// screen manages the session record and viewer discovery.

type Live = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  viewer_count: number | null;
  started_at: string;
};

export function GoLiveScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Live[]>([]);
  const [mySession, setMySession] = useState<Live | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('live_sessions')
      .select('id, user_id, title, description, status, viewer_count, started_at')
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(50);
    const rows = (data as Live[]) ?? [];
    setSessions(rows);
    setMySession(rows.find((r) => r.user_id === user?.id) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const startLive = async () => {
    if (!user || busy) return;
    const t = title.trim();
    if (!t) {
      Alert.alert('Add a title', 'Give your live stream a title first.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('live_sessions')
      .insert({ user_id: user.id, title: t, status: 'live' })
      .select('id, user_id, title, description, status, viewer_count, started_at')
      .maybeSingle();
    setBusy(false);
    if (error) {
      Alert.alert('Could not go live', error.message);
      return;
    }
    setTitle('');
    if (data) {
      setMySession(data as Live);
      load();
    }
  };

  const endLive = async () => {
    if (!mySession || busy) return;
    setBusy(true);
    await supabase
      .from('live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', mySession.id);
    setBusy(false);
    setMySession(null);
    load();
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.composer}>
        {mySession ? (
          <View style={st.liveCard}>
            <Text style={st.liveBadge}>● LIVE</Text>
            <Text style={st.liveTitle}>{mySession.title}</Text>
            <Text style={st.muted}>{mySession.viewer_count ?? 0} watching</Text>
            <TouchableOpacity style={st.endBtn} onPress={endLive} disabled={busy}>
              <Text style={st.endText}>End broadcast</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={st.input}
              value={title}
              onChangeText={setTitle}
              placeholder={`Title your ${app.eventLabel} live...`}
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity style={st.goLiveBtn} onPress={startLive} disabled={busy}>
              <Text style={st.goLiveText}>Go live</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={st.section}>Live now</Text>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={st.list}
        ListEmptyComponent={<Text style={st.empty}>No one is live right now.</Text>}
        renderItem={({ item }) => (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Text style={st.cardTitle}>{item.title}</Text>
              <Text style={st.liveBadge}>● LIVE</Text>
            </View>
            {item.description ? <Text style={st.muted}>{item.description}</Text> : null}
            <Text style={st.muted}>{item.viewer_count ?? 0} watching</Text>
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  composer: { padding: spacing.screenX, gap: 10 },
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
  goLiveBtn: { backgroundColor: colors.accent, borderRadius: radius.control, paddingVertical: 13, alignItems: 'center' },
  goLiveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  liveCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 6,
  },
  liveBadge: { color: colors.danger, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  liveTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  endBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.control,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 6,
  },
  endText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', paddingHorizontal: spacing.screenX, marginTop: 4 },
  list: { padding: spacing.screenX, gap: 12 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  muted: { color: colors.muted, fontSize: 13 },
});
