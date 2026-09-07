import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@/constants/theme';

export default function CrhsrScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>College &amp; high school rodeo</Text>
      <Text style={s.body}>
        Track eligibility, region standings, and school affiliation for collegiate and high school competitors.
      </Text>
      <View style={s.card}>
        <Text style={s.cardTitle}>Link your school</Text>
        <Text style={s.cardBody}>
          Add your school and association memberships so entry eligibility gets checked before you pay — not at the gate.
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Region standings</Text>
        <Text style={s.cardBody}>
          Once your school is connected, your region points and standings will appear here through the season.
        </Text>
      </View>
    </ScrollView>
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
