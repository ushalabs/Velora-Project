import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from '@firebase/auth';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/firestore';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'login' | 'signup';

interface FormErrors {
  email?: string;
  password?: string;
  username?: string;
}

const SESSION_STORAGE_KEY = 'velora_session_uid';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const getGoogleNativeRedirectUri = (clientId: string) => {
  const trimmedClientId = clientId.trim();
  if (!trimmedClientId) {
    return 'velora://oauth';
  }

  const clientPrefix = trimmedClientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${clientPrefix}:/oauthredirect`;
};

export default function AuthScreen() {
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const googleRedirectUri = useMemo(
    () =>
      makeRedirectUri({
        native: getGoogleNativeRedirectUri(
          Platform.OS === 'android' ? GOOGLE_ANDROID_CLIENT_ID : GOOGLE_IOS_CLIENT_ID
        ),
      }),
    []
  );

  const [googleRequest, googleResponse, promptGoogleLogin] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    selectAccount: true,
    redirectUri: googleRedirectUri,
  });

  const googleConfigured = useMemo(
    () =>
      Boolean(
        GOOGLE_WEB_CLIENT_ID.trim() ||
          GOOGLE_ANDROID_CLIENT_ID.trim() ||
          GOOGLE_IOS_CLIENT_ID.trim()
      ),
    []
  );

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthProfile((currentUser) => {
      void (async () => {
        const storedSessionUserId = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

        if (!isMounted) {
          return;
        }

        if (currentUser?.uid && storedSessionUserId === currentUser.uid) {
          router.replace('/(tabs)/friends');
          return;
        }

        if (!storedSessionUserId || !currentUser) {
          setIsRestoringSession(false);
          return;
        }
      })();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type !== 'success') {
      setIsGoogleLoading(false);
      return;
    }

    const signInWithGoogle = async () => {
      try {
        setIsGoogleLoading(true);

        const idToken =
          (googleResponse.params && 'id_token' in googleResponse.params
            ? googleResponse.params.id_token
            : null) || googleResponse.authentication?.idToken || null;
        const accessToken =
          googleResponse.authentication?.accessToken ||
          (googleResponse.params && 'access_token' in googleResponse.params
            ? googleResponse.params.access_token
            : null) ||
          null;

        if (!idToken && !accessToken) {
          throw new Error('Google did not return a valid sign-in token.');
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const result = await signInWithCredential(auth, credential);

        await AsyncStorage.setItem(SESSION_STORAGE_KEY, result.user.uid);
        await upsertUserProfile(result.user);

        router.replace('/(tabs)/friends');
      } catch (error: any) {
        Alert.alert(
          'Google Sign-In Error',
          error?.message || 'We could not sign you in with Google.'
        );
      } finally {
        setIsGoogleLoading(false);
      }
    };

    void signInWithGoogle();
  }, [googleResponse]);

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That email is already in use.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Invalid email or password.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Check your internet connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'signup') {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.trim().length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
        newErrors.username =
          'Username can only contain letters, numbers, and underscores';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const finishAuthenticatedSession = async (user: typeof auth.currentUser) => {
    if (!user) {
      throw new Error('No authenticated user found.');
    }

    await AsyncStorage.setItem(SESSION_STORAGE_KEY, user.uid);
    await upsertUserProfile(user);
    router.replace('/(tabs)/friends');
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const normalizedEmail = formData.email.trim();
      const trimmedUsername = formData.username.trim();
      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        formData.password
      );

      await updateProfile(credential.user, {
        displayName: trimmedUsername,
      });

      await upsertUserProfile({
        ...credential.user,
        displayName: trimmedUsername,
      });
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      await auth.signOut();

      setMode('login');
      setFormData({
        email: normalizedEmail,
        password: '',
        username: '',
      });
      Alert.alert(
        'Account created',
        'Your account was created successfully. Please sign in.'
      );
    } catch (error: any) {
      Alert.alert('Authentication Error', getFirebaseErrorMessage(error?.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      await finishAuthenticatedSession(credential.user);
    } catch (error: any) {
      Alert.alert('Authentication Error', getFirebaseErrorMessage(error?.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'signup') {
      await handleSignup();
      return;
    }

    await handleLogin();
  };

  const handleGoogleLogin = async () => {
    if (!googleConfigured) {
      Alert.alert(
        'Google Sign-In Not Ready',
        'Add your Google client IDs before using Google login.'
      );
      return;
    }

    try {
      setIsGoogleLoading(true);
      await promptGoogleLogin();
    } catch (error: any) {
      setIsGoogleLoading(false);
      Alert.alert(
        'Google Sign-In Error',
        error?.message || 'We could not open Google sign-in right now.'
      );
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setFormData({ email: '', password: '', username: '' });
    setErrors({});
  };

  if (isRestoringSession) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <View className="items-center">
          <Text className="text-2xl font-bold text-foreground">Velora</Text>
          <Text className="mt-3 text-muted-foreground">Restoring your session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: keyboardHeight > 0 ? 'flex-start' : 'center',
            paddingHorizontal: 24,
            paddingTop: keyboardHeight > 0 ? 24 : 32,
            paddingBottom: keyboardHeight > 0 ? 24 : 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-4">
              <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
                <Text className="text-white text-2xl font-bold">V</Text>
              </View>
            </View>
            <Text className="text-3xl font-bold text-foreground mb-2">Velora</Text>
            <Text className="text-muted-foreground text-center">
              {mode === 'login'
                ? 'Welcome back! Sign in to continue'
                : 'Create your account to start chatting'}
            </Text>
          </View>

          <View className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            {mode === 'signup' ? (
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Username</Text>
                <View
                  className={`flex-row items-center bg-input rounded-xl px-4 border ${
                    errors.username ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <User className="text-muted-foreground mr-3" size={20} />
                  <TextInput
                    className="flex-1 text-foreground py-3"
                    placeholder="Choose a username"
                    placeholderTextColor="gray"
                    value={formData.username}
                    onChangeText={(text) => {
                      setFormData((current) => ({ ...current, username: text }));
                      if (errors.username) {
                        setErrors((current) => ({ ...current, username: undefined }));
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.username ? (
                  <Text className="text-destructive text-xs mt-1 ml-1">{errors.username}</Text>
                ) : null}
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Email</Text>
              <View
                className={`flex-row items-center bg-input rounded-xl px-4 border ${
                  errors.email ? 'border-destructive' : 'border-border'
                }`}
              >
                <Mail className="text-muted-foreground mr-3" size={20} />
                <TextInput
                  className="flex-1 text-foreground py-3"
                  placeholder="Enter your email"
                  placeholderTextColor="gray"
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData((current) => ({ ...current, email: text }));
                    if (errors.email) {
                      setErrors((current) => ({ ...current, email: undefined }));
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
              {errors.email ? (
                <Text className="text-destructive text-xs mt-1 ml-1">{errors.email}</Text>
              ) : null}
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
              <View
                className={`flex-row items-center bg-input rounded-xl px-4 border ${
                  errors.password ? 'border-destructive' : 'border-border'
                }`}
              >
                <Lock className="text-muted-foreground mr-3" size={20} />
                <TextInput
                  className="flex-1 text-foreground py-3"
                  placeholder="Enter your password"
                  placeholderTextColor="gray"
                  value={formData.password}
                  onChangeText={(text) => {
                    setFormData((current) => ({ ...current, password: text }));
                    if (errors.password) {
                      setErrors((current) => ({ ...current, password: undefined }));
                    }
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  className="ml-2 p-1"
                >
                  {showPassword ? (
                    <EyeOff className="text-muted-foreground" size={20} />
                  ) : (
                    <Eye className="text-muted-foreground" size={20} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password ? (
                <Text className="text-destructive text-xs mt-1 ml-1">{errors.password}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || isGoogleLoading}
              className="bg-primary rounded-xl py-4 items-center justify-center"
              style={{ opacity: isLoading || isGoogleLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <Text className="text-primary-foreground font-semibold text-base">
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </Text>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Text className="text-primary-foreground font-semibold text-base">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading || !googleRequest}
              className="mt-3 rounded-xl py-4 items-center justify-center border border-border bg-background"
              style={{
                opacity: isLoading || isGoogleLoading || !googleRequest ? 0.7 : 1,
              }}
            >
              <Text className="text-foreground font-semibold text-base">
                {isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="items-center mt-6">
            <Text className="text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text className="text-primary font-semibold">
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-8 items-center">
            <Text className="text-xs text-muted-foreground text-center px-8">
              By continuing, you agree to Velora&apos;s Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

