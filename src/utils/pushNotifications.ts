import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Firebase Cloud Messaging registration, ported from BarrelConnect.
//
// GRACEFUL DEGRADATION: @react-native-firebase/messaging is a native module that
// only works in a dev/production build that bundled a real google-services.json /
// GoogleService-Info.plist. In Expo Go, or when the shipped Firebase config is
// still a placeholder, the native module is absent and importing it throws. We
// therefore load it lazily inside a try/catch and simply return null so the rest
// of the app keeps working without push notifications.
async function getMessagingModule() {
  try {
    return await import('@react-native-firebase/messaging');
  } catch (e) {
    console.warn('[FCM] messaging module unavailable — push notifications disabled.', e);
    return null;
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const mod = await getMessagingModule();
  if (!mod) return null;

  try {
    const { AuthorizationStatus, getMessaging, getToken, requestPermission } = mod;
    const messaging = getMessaging();

    // Android 13+ (API 33+) requires explicit runtime permission.
    const androidApiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
    if (Platform.OS === 'android' && androidApiLevel >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[FCM] Notification permission denied on Android');
        return null;
      }
    }

    if (Platform.OS === 'ios') {
      const status = await requestPermission(messaging);
      const granted =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL;
      if (!granted) {
        console.warn('[FCM] Notification permission denied on iOS');
        return null;
      }
    }

    const token = await getToken(messaging);
    return token ?? null;
  } catch (e) {
    console.warn('[FCM] Failed to register for push notifications.', e);
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('[FCM] Error saving push token:', error);
  }
}
