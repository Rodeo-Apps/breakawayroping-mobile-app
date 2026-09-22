import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, app } from '@/constants/theme';

// "More" hub, ported from BarrelConnect's overflow menu. Central entry point to
// every discipline-agnostic feature ported into the app.

type Item = { label: string; icon: string; path: string };
type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: 'Community',
    items: [
      { label: 'Messages', icon: '💬', path: '/messages' },
      { label: 'Find ropers', icon: '🔎', path: '/search' },
      { label: 'Reels', icon: '🎬', path: '/reels' },
      { label: 'Go live', icon: '📡', path: '/go-live' },
      { label: 'Notifications', icon: '🔔', path: '/notifications' },
    ],
  },
  {
    title: 'Marketplace & services',
    items: [
      { label: 'Marketplace', icon: '🛒', path: '/marketplace' },
      { label: 'Coaching', icon: '🎯', path: '/coaching' },
      { label: 'Arenas', icon: '🏟️', path: '/directory/arenas' },
      { label: 'Haulers', icon: '🚚', path: '/directory/haulers' },
      { label: 'Sponsors', icon: '🤝', path: '/directory/sponsors' },
    ],
  },
  {
    title: 'Horse care',
    items: [{ label: 'Horse health', icon: '🐴', path: '/health' }],
  },
  {
    title: 'Compete & progress',
    items: [
      { label: 'Challenges & badges', icon: '🏅', path: '/challenges' },
      { label: 'Leaderboard', icon: '📊', path: '/leaderboard' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Edit profile', icon: '✏️', path: '/edit-profile' },
      { label: 'Settings', icon: '⚙️', path: '/settings' },
      { label: 'Help & support', icon: '❓', path: '/support' },
    ],
  },
];

export function MoreScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      {user ? (
        <TouchableOpacity style={st.profileLink} onPress={() => router.push(`/user/${user.id}`)}>
          <Text style={st.profileText}>View my public profile</Text>
          <Text style={st.chevron}>›</Text>
        </TouchableOpacity>
      ) : null}

      {SECTIONS.map((section) => (
        <View key={section.title} style={st.section}>
          <Text style={st.sectionTitle}>{section.title}</Text>
          <View style={st.card}>
            {section.items.map((item, i) => (
              <TouchableOpacity
                key={item.path}
                style={[st.row, i < section.items.length - 1 && st.rowBorder]}
                onPress={() => router.push(item.path)}
              >
                <Text style={st.icon}>{item.icon}</Text>
                <Text style={st.label}>{item.label}</Text>
                <Text style={st.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={st.version}>
        {app.name} · {app.domain}
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 18, paddingBottom: 50 },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
  },
  profileText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { fontSize: 18, width: 26, textAlign: 'center' },
  label: { color: colors.text, fontSize: 15, flex: 1, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 22 },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
