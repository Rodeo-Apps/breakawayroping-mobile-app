import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, app } from '@/constants/theme';

// Settings, ported from BarrelConnect. Reads/writes `user_settings` and exposes
// the account-deletion flow. Discipline-agnostic.

type Settings = {
  push_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  show_online_status: boolean;
  allow_non_follower_messages: boolean;
};

const DEFAULTS: Settings = {
  push_notifications: true,
  email_notifications: true,
  sms_notifications: false,
  show_online_status: true,
  allow_non_follower_messages: true,
};

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('push_notifications, email_notifications, sms_notifications, show_online_status, allow_non_follower_messages')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...(data as Partial<Settings>) });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (key: keyof Settings, value: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    await supabase.from('user_settings').upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, runs and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const { error } = await supabase.rpc('delete_user_owned_data', { p_user_id: user.id });
            if (error) {
              Alert.alert('Could not delete', 'Please contact support to remove your account.');
              return;
            }
            await signOut();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const toggles: { key: keyof Settings; label: string; hint: string }[] = [
    { key: 'push_notifications', label: 'Push notifications', hint: 'Alerts on this device' },
    { key: 'email_notifications', label: 'Email notifications', hint: 'Summaries and updates by email' },
    { key: 'sms_notifications', label: 'SMS notifications', hint: 'Text alerts for key events' },
    { key: 'show_online_status', label: 'Show online status', hint: 'Let others see when you are active' },
    { key: 'allow_non_follower_messages', label: 'Messages from anyone', hint: 'Allow DMs from non-followers' },
  ];

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.section}>Notifications & privacy</Text>
      <View style={st.card}>
        {toggles.map((t, i) => (
          <View key={t.key} style={[st.row, i < toggles.length - 1 && st.rowBorder]}>
            <View style={st.rowText}>
              <Text style={st.label}>{t.label}</Text>
              <Text style={st.hint}>{t.hint}</Text>
            </View>
            <Switch
              value={settings[t.key]}
              onValueChange={(v) => update(t.key, v)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      <Text style={st.section}>Support</Text>
      <View style={st.card}>
        <TouchableOpacity style={[st.linkRow, st.rowBorder]} onPress={() => router.push('/support')}>
          <Text style={st.label}>Help & support</Text>
          <Text style={st.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.linkRow} onPress={() => router.push('/support?tab=privacy')}>
          <Text style={st.label}>Privacy policy & terms</Text>
          <Text style={st.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={st.deleteBtn} onPress={confirmDelete}>
        <Text style={st.deleteText}>Delete account</Text>
      </TouchableOpacity>
      <Text style={st.version}>{app.name} · {app.domain}</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.screenX, gap: 14, paddingBottom: 50 },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 22 },
  deleteBtn: {
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: 8,
  },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
