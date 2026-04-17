import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Mail,
  Camera,
  LogOut,
  Lock,
  ArrowLeft,
  FileText,
  Eye,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { ThemeToggle } from '@/components/ThemeToggle';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from '@firebase/auth';
import {
  getUserProfile,
  updateUserProfileAvatar,
  updateUserProfileBio,
  updateActiveStatusVisibility,
  updateUsernameWithCooldown,
  upsertUserProfile,
  USERNAME_CHANGE_COOLDOWN_MS,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useThemedAlert } from '@/components/themed-alert-provider';

cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Mail, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Camera, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(LogOut, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Lock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Eye, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const SESSION_STORAGE_KEY = 'velora_session_uid';

type ProfileState = {
  name: string;
  email: string;
  avatar: string;
  bio: string;
  showActiveStatus: boolean;
  usernameChangedAt: number;
};

export default function EditProfileScreen() {
  const { showAlert } = useThemedAlert();
  const scrollViewRef = useRef<ScrollView>(null);
  const [user, setUser] = useState<ProfileState>({
    name: '',
    email: '',
    avatar: '',
    bio: '',
    showActiveStatus: true,
    usernameChangedAt: 0,
  });
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingActiveStatus, setIsSavingActiveStatus] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [editBio, setEditBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    void requestImagePickerPermissions();

    const unsubscribe = subscribeToAuthProfile((currentUser) => {
      void (async () => {
        if (!currentUser) {
          setIsLoading(false);
          return;
        }

        const profile = await getUserProfile(currentUser.uid);
        const nextUser = {
          name: profile?.username || currentUser.displayName || 'User',
          email: currentUser.email || profile?.email || '',
          avatar: currentUser.photoURL || profile?.avatar || '',
          bio: profile?.bio || '',
          showActiveStatus: profile?.showActiveStatus !== false,
          usernameChangedAt: profile?.usernameChangedAt || 0,
        };

        setUser(nextUser);
        setAvatar(nextUser.avatar);
        setEditName(nextUser.name);
        setEditEmail(nextUser.email);
        setEditBio(nextUser.bio);
        setIsLoading(false);
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      if (showPasswordForm) {
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        });
      }
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [showPasswordForm]);

  const nextNameChangeAt = useMemo(() => {
    if (!user.usernameChangedAt) return 0;
    return user.usernameChangedAt + USERNAME_CHANGE_COOLDOWN_MS;
  }, [user.usernameChangedAt]);

  const canChangeName = !user.usernameChangedAt || Date.now() >= nextNameChangeAt;

  const requestImagePickerPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('Camera roll permission not granted');
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setIsUploading(true);
      const selectedAsset = result.assets[0];
      const upload = await uploadToCloudinary({
        uri: selectedAsset.uri,
        fileName: selectedAsset.fileName,
        mimeType: selectedAsset.mimeType,
        folder: 'velora/profile-photos',
      });
      const imageUri = upload.url;

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          photoURL: imageUri,
        });
        await updateUserProfileAvatar(auth.currentUser.uid, imageUri);
        await upsertUserProfile(auth.currentUser);
      }

      setAvatar(imageUri);
      setUser((current) => ({ ...current, avatar: imageUri }));
      showAlert('Success', 'Profile photo updated.');
    } catch {
      showAlert('Error', 'Failed to update profile photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!auth.currentUser) {
      showAlert('Error', 'No authenticated user found.');
      return;
    }

    try {
      setIsSavingName(true);
      const result = await updateUsernameWithCooldown(auth.currentUser.uid, editName);
      await updateProfile(auth.currentUser, {
        displayName: result.username,
      });
      await upsertUserProfile(auth.currentUser);

      setUser((current) => ({
        ...current,
        name: result.username,
        usernameChangedAt: result.changedAt || current.usernameChangedAt,
      }));
      setEditName(result.username);
      setIsEditingName(false);
      showAlert('Success', 'Name updated successfully.');
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to update name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveBio = async () => {
    if (!auth.currentUser) {
      showAlert('Error', 'No authenticated user found.');
      return;
    }

    try {
      setIsSavingBio(true);
      await updateUserProfileBio(auth.currentUser.uid, editBio);
      setUser((current) => ({ ...current, bio: editBio.trim() }));
      setEditBio(editBio.trim());
      setIsEditingBio(false);
      showAlert('Success', 'Bio updated successfully.');
    } catch {
      showAlert('Error', 'Failed to update bio.');
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(user.name);
    setIsEditingName(false);
  };

  const handleCancelBioEdit = () => {
    setEditBio(user.bio);
    setIsEditingBio(false);
  };

  const handleSaveEmail = async () => {
    if (!auth.currentUser || !auth.currentUser.email) {
      showAlert('Error', 'No authenticated user found.');
      return;
    }

    const normalizedEmail = editEmail.trim();
    if (!normalizedEmail) {
      showAlert('Error', 'Email is required.');
      return;
    }

    if (!emailCurrentPassword) {
      showAlert('Error', 'Please enter your current password.');
      return;
    }

    try {
      setIsSavingEmail(true);
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        emailCurrentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateEmail(auth.currentUser, normalizedEmail);

      await upsertUserProfile(auth.currentUser);
      setUser((current) => ({ ...current, email: normalizedEmail }));
      setEditEmail(normalizedEmail);
      setEmailCurrentPassword('');
      setIsEditingEmail(false);
      showAlert('Success', 'Email updated successfully.');
    } catch (error: any) {
      let message = error?.message || 'Failed to update email.';
      if (
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/invalid-credential'
      ) {
        message = 'Your current password is incorrect.';
      } else if (error?.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error?.code === 'auth/email-already-in-use') {
        message = 'That email is already in use.';
      } else if (error?.code === 'auth/requires-recent-login') {
        message = 'For security, please log out and log back in before changing your email.';
      }
      showAlert('Error', message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleCancelEmailEdit = () => {
    setEditEmail(user.email);
    setEmailCurrentPassword('');
    setIsEditingEmail(false);
  };

  const handleToggleActiveStatus = async () => {
    if (!auth.currentUser || isSavingActiveStatus) {
      return;
    }

    const nextValue = !user.showActiveStatus;
    try {
      setIsSavingActiveStatus(true);
      await updateActiveStatusVisibility(auth.currentUser.uid, nextValue);
      setUser((current) => ({ ...current, showActiveStatus: nextValue }));
    } catch {
      showAlert('Error', 'Failed to update active status privacy.');
    } finally {
      setIsSavingActiveStatus(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !auth.currentUser.email) {
      showAlert('Error', 'No authenticated user found.');
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('Error', 'Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Error', 'New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      showAlert('Success', 'Password changed successfully.');
    } catch (error: any) {
      let message = 'Failed to change password.';
      if (
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/invalid-credential'
      ) {
        message = 'Your current password is incorrect.';
      } else if (error?.code === 'auth/weak-password') {
        message = 'New password must be at least 6 characters.';
      } else if (error?.code === 'auth/provider-already-linked') {
        message = 'This account does not support password changes here.';
      } else if (error?.message) {
        message = error.message;
      }

      showAlert('Error', message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordFieldFocus = (_event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      await signOut(auth);
      router.replace('/');
    } catch {
      showAlert('Error', 'Failed to logout');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#A78BFA" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
              <ArrowLeft className="text-foreground" size={24} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Edit Profile</Text>
          </View>
          <ThemeToggle />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            paddingBottom: showPasswordForm
              ? Math.max(160, keyboardHeight + 72)
              : 128,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View className="items-center pt-8 pb-6">
            <View className="relative">
              <View className="w-32 h-32 rounded-full overflow-hidden border-4 border-card shadow-lg bg-muted items-center justify-center">
                {isUploading ? (
                  <ActivityIndicator size="large" color="#8B5CF6" />
                ) : avatar ? (
                  <Image source={{ uri: avatar }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <User size={48} color="#A78BFA" />
                )}
              </View>
              <TouchableOpacity
                onPress={handleImageUpload}
                activeOpacity={0.8}
                className="absolute bottom-0 right-0 bg-primary p-2.5 rounded-full shadow-md border-2 border-card"
              >
                <Camera size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View className="items-center mt-4 w-full px-8">
              <Text className="text-2xl font-bold text-foreground">{user.name}</Text>
            </View>
          </View>

          <View className="px-6 gap-4">
            <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <View className="flex-row items-center gap-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <User className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground uppercase font-semibold">Name</Text>
                  <Text className="text-foreground font-medium mt-1">{user.name}</Text>
                  {!canChangeName ? (
                    <Text className="text-xs text-muted-foreground mt-2">
                      Changeable after {new Date(nextNameChangeAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                {!isEditingName ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingName(true)}
                    className="bg-muted px-3 py-2 rounded-full border border-border"
                  >
                    <Text className="text-foreground font-semibold text-xs">Change Name</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditingName ? (
                <View className="mt-4">
                  <TextInput
                    className="text-foreground font-medium border border-border rounded-xl px-4 py-3"
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter new name"
                    editable={canChangeName}
                  />
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      className="flex-1 bg-secondary px-4 py-3 rounded-xl items-center"
                    >
                      <Text className="text-secondary-foreground font-semibold">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveName}
                      disabled={isSavingName || !canChangeName}
                      className="flex-1 bg-primary px-4 py-3 rounded-xl items-center"
                      style={{ opacity: isSavingName || !canChangeName ? 0.7 : 1 }}
                    >
                      <Text className="text-primary-foreground font-semibold">
                        {isSavingName ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <View className="flex-row items-center gap-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <FileText className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground uppercase font-semibold">Bio</Text>
                  <Text className="text-foreground font-medium mt-1">
                    {user.bio || 'No bio yet'}
                  </Text>
                </View>
                {!isEditingBio ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingBio(true)}
                    className="bg-muted px-3 py-2 rounded-full border border-border"
                  >
                    <Text className="text-foreground font-semibold text-xs">Edit Bio</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditingBio ? (
                <View className="mt-4">
                  <TextInput
                    className="min-h-[120px] text-foreground font-medium border border-border rounded-xl px-4 py-3"
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Tell people about yourself"
                    multiline
                    maxLength={180}
                  />
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={handleCancelBioEdit}
                      className="flex-1 bg-secondary px-4 py-3 rounded-xl items-center"
                    >
                      <Text className="text-secondary-foreground font-semibold">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveBio}
                      disabled={isSavingBio}
                      className="flex-1 bg-primary px-4 py-3 rounded-xl items-center"
                      style={{ opacity: isSavingBio ? 0.7 : 1 }}
                    >
                      <Text className="text-primary-foreground font-semibold">
                        {isSavingBio ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <View className="flex-row items-center gap-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <Eye className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground uppercase font-semibold">
                    Active Status
                  </Text>
                  <Text className="text-foreground font-medium mt-1">
                    {user.showActiveStatus ? 'Friends can see when you are active.' : 'Your active status is hidden.'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleToggleActiveStatus}
                  disabled={isSavingActiveStatus}
                  className={`px-3 py-2 rounded-full border ${
                    user.showActiveStatus ? 'bg-primary border-primary' : 'bg-muted border-border'
                  }`}
                >
                  <Text
                    className={`font-semibold text-xs ${
                      user.showActiveStatus ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {isSavingActiveStatus ? 'Saving...' : user.showActiveStatus ? 'On' : 'Off'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <View className="flex-row items-center gap-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <Mail className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground uppercase font-semibold">Email</Text>
                  <Text className="text-foreground font-medium mt-1">{user.email}</Text>
                </View>
                {!isEditingEmail ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingEmail(true)}
                    className="bg-muted px-3 py-2 rounded-full border border-border"
                  >
                    <Text className="text-foreground font-semibold text-xs">Change Email</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditingEmail ? (
                <View className="mt-4">
                  <TextInput
                    className="text-foreground font-medium border border-border rounded-xl px-4 py-3"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Enter new email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={handlePasswordFieldFocus}
                  />
                  <TextInput
                    className="mt-3 text-foreground font-medium border border-border rounded-xl px-4 py-3"
                    value={emailCurrentPassword}
                    onChangeText={setEmailCurrentPassword}
                    placeholder="Current password"
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={handlePasswordFieldFocus}
                  />
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={handleCancelEmailEdit}
                      className="flex-1 bg-secondary px-4 py-3 rounded-xl items-center"
                    >
                      <Text className="text-secondary-foreground font-semibold">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEmail}
                      disabled={isSavingEmail}
                      className="flex-1 bg-primary px-4 py-3 rounded-xl items-center"
                      style={{ opacity: isSavingEmail ? 0.7 : 1 }}
                    >
                      <Text className="text-primary-foreground font-semibold">
                        {isSavingEmail ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
              <View className="flex-row items-center gap-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <Lock className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground uppercase font-semibold">
                    Password
                  </Text>
                </View>
                {!showPasswordForm ? (
                  <TouchableOpacity
                    onPress={() => setShowPasswordForm(true)}
                    className="bg-muted px-3 py-2 rounded-full border border-border"
                  >
                    <Text className="text-foreground font-semibold text-xs">Change Password</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {showPasswordForm ? (
                <View
                  className="mt-4"
                  style={{
                    paddingBottom: keyboardHeight > 0 ? 12 : 0,
                  }}
                >
                  <TextInput
                    className="text-foreground font-medium border border-border rounded-xl px-4 py-3 mb-3"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Current password"
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={handlePasswordFieldFocus}
                  />

                  <TextInput
                    className="text-foreground font-medium border border-border rounded-xl px-4 py-3 mb-3"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={handlePasswordFieldFocus}
                  />

                  <TextInput
                    className="text-foreground font-medium border border-border rounded-xl px-4 py-3"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={handlePasswordFieldFocus}
                  />

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="flex-1 bg-secondary px-4 py-3 rounded-xl items-center"
                    >
                      <Text className="text-secondary-foreground font-semibold">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleChangePassword}
                      disabled={isChangingPassword}
                      className="flex-1 bg-primary px-4 py-3 rounded-xl items-center"
                      style={{ opacity: isChangingPassword ? 0.7 : 1 }}
                    >
                      <Text className="text-primary-foreground font-semibold">
                        {isChangingPassword ? 'Updating...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          <View className="px-6 mt-8">
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-destructive rounded-2xl p-4 flex-row items-center justify-center gap-2 shadow-sm border border-destructive"
            >
              <LogOut size={20} color="white" />
              <Text className="text-white font-semibold">Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
