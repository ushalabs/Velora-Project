import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from '@firebase/auth';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';

const SESSION_STORAGE_KEY = 'velora_session_uid';

export default function AppEntryScreen() {
  useEffect(() => {
    let isActive = true;

    const unsubscribe = subscribeToAuthProfile((user) => {
      void (async () => {
        const storedSessionUserId = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

        if (!isActive) {
          return;
        }

        if (!storedSessionUserId) {
          if (user) {
            await signOut(auth).catch(() => {
              // Ignore cleanup failures; routing still falls back to auth.
            });
          }
          router.replace('/auth');
          return;
        }

        if (user?.uid && storedSessionUserId === user.uid) {
          router.replace('/(tabs)/friends');
          return;
        }

        if (!user) {
          return;
        }

        await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {
          // Ignore stale session cleanup failures.
        });

        if (user) {
          await signOut(auth).catch(() => {
            // Ignore sign-out cleanup failures for stale sessions.
          });
        }

        if (isActive) {
          router.replace('/auth');
        }
      })();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
}
