import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { colors, radius, spacing, app } from '@/constants/theme';

// Help / support / legal, ported from BarrelConnect. Static help content plus
// the privacy policy and terms, rebranded to this app.

type Tab = 'help' | 'privacy';

const FAQ = [
  {
    q: 'How does AI run analysis work?',
    a: `Record or upload your ${app.eventLabel} run and ${app.short} breaks it down frame by frame — barrier, swing, catch and time — with coaching feedback.`,
  },
  { q: 'How do I book a coaching session?', a: 'Open Coaching, pick an available session and tap Book. Your coach is notified instantly.' },
  { q: 'How do I sell tack or a horse?', a: 'Go to Marketplace and tap "Sell an item". Add photos, a price and a description.' },
  { q: 'How are leaderboard points earned?', a: 'You earn points for logged runs and completed daily challenges. Boards reset every week.' },
];

export function SupportScreen() {
  const params = useLocalSearchParams<{ tab: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'privacy' ? 'privacy' : 'help');

  return (
    <View style={st.container}>
      <View style={st.tabs}>
        <TouchableOpacity style={[st.tab, tab === 'help' && st.tabActive]} onPress={() => setTab('help')}>
          <Text style={[st.tabText, tab === 'help' && st.tabTextActive]}>Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.tab, tab === 'privacy' && st.tabActive]} onPress={() => setTab('privacy')}>
          <Text style={[st.tabText, tab === 'privacy' && st.tabTextActive]}>Privacy & Terms</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {tab === 'help' ? (
          <>
            {FAQ.map((f) => (
              <View key={f.q} style={st.card}>
                <Text style={st.q}>{f.q}</Text>
                <Text style={st.a}>{f.a}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={st.contactBtn}
              onPress={() => Linking.openURL(`mailto:support@${app.domain}`)}
            >
              <Text style={st.contactText}>Contact support</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={st.legalTitle}>Privacy Policy</Text>
            <Text style={st.legal}>
              {app.name} collects the account, profile and performance data you provide to run the app —
              including your runs, videos, horses and messages. We use it to deliver analysis, coaching and
              social features. We never sell your personal data. You can export or delete your data at any time
              from Settings.
            </Text>
            <Text style={st.legalTitle}>Terms of Service</Text>
            <Text style={st.legal}>
              By using {app.name} you agree to use it lawfully and respectfully. Marketplace and coaching
              transactions are between users; {app.name} is not a party to those agreements. Content you post
              remains yours, but you grant {app.name} a license to display it within the app. We may suspend
              accounts that violate these terms.
            </Text>
            <Text style={st.legal}>
              Questions? Email support@{app.domain}.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: 8, padding: spacing.screenX, paddingBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  q: { color: colors.text, fontSize: 15, fontWeight: '700' },
  a: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  contactBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  legalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  legal: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
