import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

type Props = { children: React.ReactNode; featureName?: string };

export const PremiumGate: React.FC<Props> = ({ children, featureName = 'this feature' }) => {
  const { profile } = useAuth();
  if (profile?.has_premium_access) return <>{children}</>;
  return (
    <View style={s.container}>
      <Text style={s.icon}>⭐</Text>
      <Text style={s.title}>Premium required</Text>
      <Text style={s.body}>
        Unlock {featureName} and all AI coaching tools with a Rodeo Apps Premium subscription.
      </Text>
      <TouchableOpacity style={s.btn} onPress={() => router.push('/premium')}>
        <Text style={s.btnText}>Unlock Premium</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screenX, gap: 16 },
  icon: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
