import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius, app } from '@/constants/theme';

export function ProfileScreen() {
  const { user, profile, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(profile?.full_name ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={s.name}>{profile?.full_name ?? 'Rodeo athlete'}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={[s.badge, profile?.has_premium_access ? s.badgePremium : s.badgeFree]}>
          <Text style={s.badgeText}>{profile?.has_premium_access ? '⭐ Premium' : 'Free plan'}</Text>
        </View>
      </View>

      {!profile?.has_premium_access && (
        <TouchableOpacity style={s.upgradeCard} onPress={() => router.push('/premium')}>
          <Text style={s.upgradeTitle}>Unlock Premium</Text>
          <Text style={s.upgradeBody}>Get AI video analysis and coaching tools for your {app.eventLabel} runs.</Text>
        </TouchableOpacity>
      )}

      <View style={s.section}>
        <TouchableOpacity style={s.row} onPress={() => router.push('/team-analysis')}>
          <Text style={s.rowText}>Team analysis</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={() => router.push('/crhsr')}>
          <Text style={s.rowText}>College &amp; high school rodeo</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={() => router.push('/premium')}>
          <Text style={s.rowText}>Manage subscription</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.signOut} onPress={confirmSignOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <Text style={s.version}>{app.name} · {app.domain}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: spacing.gap },
  header: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  email: { fontSize: 14, color: colors.muted },
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, marginTop: 4 },
  badgePremium: { backgroundColor: colors.accent },
  badgeFree: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badgeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  upgradeCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, borderWidth: 1, borderColor: colors.accent, gap: 4 },
  upgradeTitle: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  upgradeBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  section: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { color: colors.text, fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 22 },
  signOut: { alignItems: 'center', padding: 14, borderRadius: radius.control, borderWidth: 1, borderColor: colors.danger },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
