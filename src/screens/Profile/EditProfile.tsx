import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Edit-profile form, ported from BarrelConnect. Writes the discipline-agnostic
// `profiles` fields (name/username/bio/location/avatar_url).

export function EditProfileScreen() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('name, username, bio, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const row = data as { name: string | null; username: string | null; bio: string | null; avatar_url: string | null } | null;
    if (row) {
      setName(row.name ?? '');
      setUsername(row.username ?? '');
      setBio(row.bio ?? '');
      setAvatarUrl(row.avatar_url ?? '');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshProfile?.();
    router.back();
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Your full name" />
      <Field label="Username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" />
      <Field label="Avatar image URL" value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://upload.wikimedia.org/wikipedia/commons/3/3a/Style_-_Wouldn%27t_It_Be_Nice.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original" autoCapitalize="none" />
      <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell the community about your roping..." multiline />
      <Button label={saving ? 'Saving...' : 'Save changes'} onPress={save} disabled={saving} />
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
  autoCapitalize?: 'none' | 'sentences';
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
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.screenX, gap: 18, paddingBottom: 60 },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
});
