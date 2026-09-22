import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/utils/toast';

// Foreground/notification-tap handling for FCM, ported from BarrelConnect and
// adapted to Breakaway Roping's route table.
//
// GRACEFUL DEGRADATION: the Firebase messaging native module is imported lazily
// inside the effect. If it is missing (Expo Go, or a build without a real
// google-services.json / GoogleService-Info.plist) the hook is a no-op and the
// app keeps running without push notifications.

type FcmDataRecord = Record<string, unknown> | undefined;

interface FcmRemoteMessage {
  notification?: { title?: string; body?: string } | null;
  data?: FcmDataRecord;
}

export function useFCMMessaging() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      let mod: typeof import('@react-native-firebase/messaging') | null = null;
      try {
        mod = await import('@react-native-firebase/messaging');
      } catch (e) {
        console.warn('[FCM] messaging module unavailable — notifications disabled.', e);
        return;
      }
      if (cancelled || !mod) return;

      try {
        const {
          getInitialNotification,
          getMessaging,
          onMessage,
          onNotificationOpenedApp,
          onTokenRefresh,
        } = mod;
        const messaging = getMessaging();

        // Foreground: FCM does not auto-display notifications while the app is
        // open, so we surface the title+body via our alert helper instead.
        const unsubscribeForeground = onMessage(messaging, async (remoteMessage) => {
          const title = remoteMessage.notification?.title;
          const body = remoteMessage.notification?.body;
          if (title || body) {
            showAlert(`${title ? title + ': ' : ''}${body ?? ''}`);
          }
        });

        // Token rotated by FCM — keep the DB in sync.
        const unsubscribeTokenRefresh = onTokenRefresh(messaging, async (newToken) => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          await supabase
            .from('profiles')
            .update({ push_token: newToken })
            .eq('id', session.user.id);
        });

        // Background → foreground: user tapped a notification while backgrounded.
        const unsubscribeOpenedApp = onNotificationOpenedApp(messaging, (remoteMessage) => {
          navigateFromNotification(remoteMessage as FcmRemoteMessage);
        });

        // Quit state: app was fully closed, user tapped to open it.
        getInitialNotification(messaging).then((remoteMessage) => {
          if (!remoteMessage) return;
          // Small delay so expo-router has time to mount before we push.
          setTimeout(() => navigateFromNotification(remoteMessage as FcmRemoteMessage), 500);
        });

        cleanup = () => {
          unsubscribeForeground();
          unsubscribeTokenRefresh();
          unsubscribeOpenedApp();
        };
      } catch (e) {
        console.warn('[FCM] Failed to initialise messaging listeners.', e);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
}

function fcmDataString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function navigateFromNotification(remoteMessage: FcmRemoteMessage) {
  const data = remoteMessage.data;
  if (!data) return;

  switch (data.type) {
    case 'new_message':
    case 'group_message': {
      const senderId = fcmDataString(data.sender_id) || fcmDataString(data.related_user_id);
      if (senderId) {
        router.push(`/messages/${senderId}`);
      } else {
        router.push('/messages');
      }
      break;
    }
    case 'new_follower': {
      const userId = fcmDataString(data.related_user_id);
      if (userId) {
        router.push(`/user/${userId}`);
      } else {
        router.push('/notifications');
      }
      break;
    }
    case 'post_like':
    case 'new_comment':
    case 'comment_reply':
    case 'post_reply':
      router.push('/notifications');
      break;
    case 'marketplace_view': {
      const listingId = fcmDataString(data.listing_id);
      if (listingId) {
        router.push(`/marketplace/${listingId}`);
      } else {
        router.push('/(tabs)');
      }
      break;
    }
    default:
      router.push('/(tabs)');
  }
}
