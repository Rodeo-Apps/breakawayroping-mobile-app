import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function TeamAnalysisLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Team Analysis' }} />
      <Stack.Screen name="[teamId]" options={{ title: 'Team' }} />
      <Stack.Screen name="new-review" options={{ title: 'New Review' }} />
      <Stack.Screen name="processing" options={{ title: 'Analyzing', headerBackVisible: false }} />
      <Stack.Screen name="report" options={{ title: 'Report' }} />
    </Stack>
  );
}
