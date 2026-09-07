import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { PremiumGate } from '@/components/PremiumGate';
import { colors, spacing, radius, app } from '@/constants/theme';

function TeamAnalysisInner() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Team analysis</Text>
      <Text style={s.body}>
        Coaches and team captains can review every athlete&apos;s {app.eventLabel} runs in one place, compare AI breakdowns,
        and assign drills.
      </Text>
      <View style={s.card}>
        <Text style={s.cardTitle}>Coming to your team</Text>
        <Text style={s.cardBody}>
          Connect a coaching team to your account to unlock shared run history, side-by-side video comparison, and progress
          tracking across every roster member.
        </Text>
      </View>
    </ScrollView>
  );
}

export default function TeamAnalysisScreen() {
  return (
    <PremiumGate featureName="team analysis">
      <TeamAnalysisInner />
    </PremiumGate>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.cardPad, gap: 8, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 14, color: colors.muted, lineHeight: 21 },
});
