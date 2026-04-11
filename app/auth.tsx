import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard, KeyboardEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from '@firebase/auth';
import { auth } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/firestore';

type AuthMode = 'login' | 'signup';

interface FormErrors {
  email?: string;
  password?: string;
  username?: string;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

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

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That email is already in use.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
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

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Username validation (only for signup)
    if (mode === 'signup') {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = 'Username can only contain letters, numbers, and underscores';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(
          auth,
          formData.email.trim(),
          formData.password
        );

        await updateProfile(credential.user, {
          displayName: formData.username.trim(),
        });

        await upsertUserProfile(credential.user);

        Alert.alert(
          'Account created',
          'Your account was created successfully. Please sign in.'
        );

        await auth.signOut();
        setMode('login');
        setFormData({
          email: formData.email.trim(),
          password: '',
          username: '',
        });
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          formData.email.trim(),
          formData.password
        );

        await upsertUserProfile(credential.user);

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', getFirebaseErrorMessage(error?.code));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setFormData({ email: '', password: '', username: '' });
    setErrors({});
  };

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
          {/* Logo / Brand */}
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

          {/* Form Card */}
          <View className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            {/* Username Field (Signup only) */}
            {mode === 'signup' && (
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Username</Text>
                <View className={`flex-row items-center bg-input rounded-xl px-4 border ${errors.username ? 'border-destructive' : 'border-border'}`}>
                  <User className="text-muted-foreground mr-3" size={20} />
                  <TextInput
                    className="flex-1 text-foreground py-3"
                    placeholder="Choose a username"
                    placeholderTextColor="gray"
                    value={formData.username}
                    onChangeText={(text) => {
                      setFormData({ ...formData, username: text });
                      if (errors.username) setErrors({ ...errors, username: undefined });
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.username && (
                  <Text className="text-destructive text-xs mt-1 ml-1">{errors.username}</Text>
                )}
              </View>
            )}

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Email</Text>
              <View className={`flex-row items-center bg-input rounded-xl px-4 border ${errors.email ? 'border-destructive' : 'border-border'}`}>
                <Mail className="text-muted-foreground mr-3" size={20} />
                <TextInput
                  className="flex-1 text-foreground py-3"
                  placeholder="Enter your email"
                  placeholderTextColor="gray"
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData({ ...formData, email: text });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
              {errors.email && (
                <Text className="text-destructive text-xs mt-1 ml-1">{errors.email}</Text>
              )}
            </View>

            {/* Password Field */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
              <View className={`flex-row items-center bg-input rounded-xl px-4 border ${errors.password ? 'border-destructive' : 'border-border'}`}>
                <Lock className="text-muted-foreground mr-3" size={20} />
                <TextInput
                  className="flex-1 text-foreground py-3"
                  placeholder="Enter your password"
                  placeholderTextColor="gray"
                  value={formData.password}
                  onChangeText={(text) => {
                    setFormData({ ...formData, password: text });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="ml-2 p-1"
                >
                  {showPassword ? (
                    <EyeOff className="text-muted-foreground" size={20} />
                  ) : (
                    <Eye className="text-muted-foreground" size={20} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text className="text-destructive text-xs mt-1 ml-1">{errors.password}</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className="bg-primary rounded-xl py-4 items-center justify-center"
              style={{ opacity: isLoading ? 0.7 : 1 }}
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
          </View>

          {/* Toggle Mode */}
          <View className="items-center mt-6">
            <Text className="text-muted-foreground">
              {mode === 'login' ? "Don\u2019t have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text className="text-primary font-semibold">
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
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
