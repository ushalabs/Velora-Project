import { Stack } from 'expo-router';
import '@/global.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemedAlertProvider } from '@/components/themed-alert-provider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, LogBox } from 'react-native';
import { useEffect, useRef } from 'react';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import {
  configureForegroundNotifications,
  registerPushToken,
  unregisterPushToken,
} from '@/lib/notifications';
import { navigateFromNotificationPayload } from '@/lib/notification-routing';
import { updateUserPresence } from '@/lib/firestore';

export default function RootLayout() {
  const previousUserIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    LogBox.ignoreLogs([
      'SafeAreaView has been deprecated',
    ]);

    void configureForegroundNotifications().catch(() => {
      // Keep app startup safe even if notifications are unavailable.
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthProfile((user) => {
      void (async () => {
        if (user?.uid) {
          previousUserIdRef.current = user.uid;
          await updateUserPresence(user.uid, true).catch(() => {});
          await registerPushToken(user.uid).catch(() => {
            // Notifications should never block auth flow.
          });
          return;
        }

        if (!previousUserIdRef.current) {
          return;
        }

        const lastUserId = previousUserIdRef.current;
        previousUserIdRef.current = null;
        await updateUserPresence(lastUserId, false).catch(() => {});

        await unregisterPushToken(lastUserId).catch(() => {
          // Ignore logout cleanup failures.
        });
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    const handleNotificationNavigation = (data: unknown) => {
      const currentUserId = auth.currentUser?.uid || previousUserIdRef.current || null;
      navigateFromNotificationPayload(data, currentUserId);
    };

    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!isMounted) return;

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handleNotificationNavigation(lastResponse.notification.request.content.data);
        }

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationNavigation(response.notification.request.content.data);
        });
      } catch {
        // Keep startup stable even if notification response listener fails.
      }
    })();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const startHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      heartbeatInterval = setInterval(() => {
        const userId = auth.currentUser?.uid || previousUserIdRef.current;
        if (!userId || appStateRef.current !== 'active') {
          return;
        }

        void updateUserPresence(userId, true).catch(() => {});
      }, 45000);
    };

    startHeartbeat();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      const userId = auth.currentUser?.uid || previousUserIdRef.current;

      if (!userId) {
        return;
      }

      if (nextAppState === 'active') {
        void updateUserPresence(userId, true).catch(() => {});
      } else if (previousAppState === 'active') {
        void updateUserPresence(userId, false).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedAlertProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="oauthredirect" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="add-friend" />
            <Stack.Screen name="create-group" />
            <Stack.Screen name="group-manage/[id]" />
          </Stack>
        </ThemedAlertProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
