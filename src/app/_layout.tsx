import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initRevenueCat } from '@/services/iapService';
import { useFCMMessaging } from '@/hooks/useFCMMessaging';
import { registerForPushNotificationsAsync, savePushToken } from '@/utils/pushNotifications';
import { AppStripeProvider } from '@/services/stripe/AppStripeProvider';
import { colors } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
});

initRevenueCat();

function AuthGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    if (!session && !inAuth) router.replace('/auth/login');
    if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading, segments]);
  return null;
}

// Bridges Firebase Cloud Messaging into the app: registers foreground/tap
// handlers and, once a user is signed in, registers the device for push and
// persists the token to profiles.push_token. All FCM calls degrade gracefully
// (no-op) when Firebase is not configured — see utils/pushNotifications.
function NotificationsBridge() {
  const { user } = useAuth();
  useFCMMessaging();
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!cancelled && token) await savePushToken(user.id, token);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppStripeProvider>
            <AuthGuard />
            <NotificationsBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="analyze" options={{ title: 'Video Analysis', presentation: 'modal' }} />
              <Stack.Screen name="premium" options={{ title: 'Go Premium', presentation: 'modal' }} />
              <Stack.Screen name="team-analysis" options={{ headerShown: false }} />
              <Stack.Screen name="crhsr" options={{ headerShown: false }} />
              <Stack.Screen name="event/[eventId]" options={{ title: 'Event' }} />
              <Stack.Screen name="horse/[horseId]" options={{ title: 'Details' }} />
              <Stack.Screen name="add-horse" options={{ title: 'Add', presentation: 'modal' }} />

              {/* Phase 2 — ported discipline-agnostic feature routes */}
              <Stack.Screen name="marketplace/index" options={{ title: 'Marketplace' }} />
              <Stack.Screen name="marketplace/create" options={{ title: 'Sell an item', presentation: 'modal' }} />
              <Stack.Screen name="marketplace/[id]" options={{ title: 'Listing' }} />
              <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
              <Stack.Screen name="messages/[userId]" options={{ title: 'Chat' }} />
              <Stack.Screen name="directory/arenas" options={{ title: 'Arenas' }} />
              <Stack.Screen name="directory/haulers" options={{ title: 'Haulers' }} />
              <Stack.Screen name="directory/sponsors" options={{ title: 'Sponsors' }} />
              <Stack.Screen name="search" options={{ title: 'Find ropers' }} />
              <Stack.Screen name="user/[userId]/index" options={{ title: 'Profile' }} />
              <Stack.Screen name="user/[userId]/connections" options={{ title: 'Connections' }} />
              <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', presentation: 'modal' }} />
              <Stack.Screen name="health" options={{ title: 'Horse health' }} />
              <Stack.Screen name="coaching" options={{ title: 'Coaching' }} />
              <Stack.Screen name="challenges" options={{ title: 'Challenges' }} />
              <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
              <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="support" options={{ title: 'Help & support' }} />
              <Stack.Screen name="reels" options={{ title: 'Reels' }} />
              <Stack.Screen name="go-live" options={{ title: 'Go live' }} />
            </Stack>
            </AppStripeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
