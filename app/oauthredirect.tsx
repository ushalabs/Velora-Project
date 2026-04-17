import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleAuthProvider, signInWithCredential } from '@firebase/auth';
import { auth } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/firestore';
import { useThemedAlert } from '@/components/themed-alert-provider';

const SESSION_STORAGE_KEY = 'velora_session_uid';

export default function OAuthRedirectScreen() {
  const { showAlert } = useThemedAlert();
  const params = useLocalSearchParams<{
    id_token?: string | string[];
    access_token?: string | string[];
    error?: string | string[];
  }>();

  useEffect(() => {
    const finishGoogleSignIn = async () => {
      try {
        const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
        if (errorParam) {
          throw new Error(errorParam);
        }

        const idToken = Array.isArray(params.id_token) ? params.id_token[0] : params.id_token;
        const accessToken = Array.isArray(params.access_token)
          ? params.access_token[0]
          : params.access_token;

        if (!idToken && !accessToken) {
          router.replace('/auth');
          return;
        }

        const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
        const result = await signInWithCredential(auth, credential);

        await AsyncStorage.setItem(SESSION_STORAGE_KEY, result.user.uid);
        await upsertUserProfile(result.user);

        router.replace('/(tabs)/friends');
      } catch (error: any) {
        showAlert(
          'Google Sign-In Error',
          error?.message || 'We could not finish Google sign-in.',
          () => router.replace('/auth')
        );
      }
    };

    void finishGoogleSignIn();
  }, [params.access_token, params.error, params.id_token, showAlert]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
}
