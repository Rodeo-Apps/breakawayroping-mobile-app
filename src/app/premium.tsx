import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '@/services/iapService';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const PERKS = [
  'AI video analysis on every run',
  'Frame-by-frame breakdown of your technique',
  'Personalised drills and coaching cues',
  'Team analysis tools',
  'Unlimited run history and trends',
];

export default function PremiumScreen() {
  const { profile, refreshProfile } = useAuth();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getOfferings()
      .then((offering) => {
        if (offering) setPackages(offering.availablePackages);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    try {
      const ok = await purchasePackage(pkg);
      if (ok) {
        await refreshProfile();
        Alert.alert('Welcome to Premium', 'Your subscription is now active.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      if (!e?.userCancelled) Alert.alert('Purchase failed', e?.message ?? 'Please try again');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const ok = await restorePurchases();
    if (ok) await refreshProfile();
    setPurchasing(false);
    Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Your premium access is active.' : 'No active subscription found.');
  };

  if (profile?.has_premium_access) {
    return (
      <View style={s.centered}>
        <Text style={s.icon}>⭐</Text>
        <Text style={s.title}>You&apos;re Premium</Text>
        <Text style={s.body}>Thanks for supporting the app. All coaching tools are unlocked.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.icon}>⭐</Text>
      <Text style={s.title}>Rodeo Apps Premium</Text>
      <Text style={s.body}>Turn every practice run into coaching feedback.</Text>
      <View style={s.perks}>
        {PERKS.map((perk) => (
          <View key={perk} style={s.perkRow}>
            <Text style={s.check}>✓</Text>
            <Text style={s.perkText}>{perk}</Text>
          </View>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : packages.length === 0 ? (
        <Text style={s.note}>Subscription options are not available right now. Please try again later.</Text>
      ) : (
        packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.identifier}
            style={[s.planBtn, purchasing && s.disabled]}
            onPress={() => handlePurchase(pkg)}
            disabled={purchasing}
          >
            <Text style={s.planTitle}>{pkg.product.title}</Text>
            <Text style={s.planPrice}>{pkg.product.priceString}</Text>
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={{ marginTop: 8 }}>
        <Text style={s.link}>Restore purchases</Text>
      </TouchableOpacity>
      <Text style={s.legal}>
        Payment is charged to your app store account. Subscriptions renew automatically unless cancelled at least 24 hours
        before the end of the period. Manage in your app store settings.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 12, alignItems: 'center' },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.screenX, gap: 16 },
  icon: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  perks: { alignSelf: 'stretch', gap: 12, marginVertical: 16 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { color: colors.success, fontSize: 18, fontWeight: '700' },
  perkText: { color: colors.text, fontSize: 15, flex: 1 },
  planBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  planPrice: { color: '#fff', fontSize: 14 },
  disabled: { opacity: 0.6 },
  note: { color: colors.muted, textAlign: 'center', marginTop: 16 },
  link: { color: colors.accent, fontSize: 14, textAlign: 'center' },
  legal: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 16 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
