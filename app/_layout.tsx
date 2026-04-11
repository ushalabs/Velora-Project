import { Stack } from 'expo-router';
import '@/global.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from '@firebase/auth';
import { auth } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/firestore';
import {
  configureForegroundNotifications,
  registerPushToken,
  unregisterPushToken,
} from '@/lib/notifications';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    void configureForegroundNotifications().catch(() => {
      // Keep app startup safe even if notification setup is unavailable.
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);

      if (user) {
        previousUserIdRef.current = user.uid;

        void upsertUserProfile(user).catch(() => {
          // Do not block app startup on profile sync failures.
        });

        void registerPushToken(user.uid).catch(() => {
          // Notifications should never block auth/bootstrap flow.
        });
      } else if (previousUserIdRef.current) {
        const lastUserId = previousUserIdRef.current;
        previousUserIdRef.current = null;

        void unregisterPushToken(lastUserId).catch(() => {
          // Ignore logout cleanup failures to keep auth flow safe.
        });
      }
    });

    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color="#A78BFA" />
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="add-friend" options={{ headerShown: false }} />
              <Stack.Screen name="create-group" options={{ headerShown: false }} />
              <Stack.Screen name="group-manage/[id]" options={{ headerShown: false }} />
            </>
          )}
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
