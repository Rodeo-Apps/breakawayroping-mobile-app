import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function CrhsrLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'College Rodeo' }} />
      <Stack.Screen name="register" options={{ title: 'Register' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify Athletes' }} />
      <Stack.Screen name="manage" options={{ title: 'Manage Team' }} />
      <Stack.Screen name="[schoolId]" options={{ title: 'School' }} />
    </Stack>
  );
}
