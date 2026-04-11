import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Settings, Camera, Edit2, Check, X, LogOut } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { ThemeToggle } from '@/components/ThemeToggle';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import { signOut, updateEmail, updateProfile } from '@firebase/auth';
import { upsertUserProfile } from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Icon interops
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Mail, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Settings, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Camera, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Edit2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Check, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(LogOut, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function ProfileScreen() {
  const [user, setUser] = useState({
    name: '',
    email: '',
    avatar: ''
  });
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editable states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    requestImagePickerPermissions();
    const unsubscribe = subscribeToAuthProfile((currentUser) => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const userProfile = {
        name: currentUser.displayName || 'User',
        email: currentUser.email || '',
        avatar: currentUser.photoURL || '',
      };

      setUser(userProfile);
      setAvatar(userProfile.avatar);
      setEditName(userProfile.name);
      setEditEmail(userProfile.email);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const requestImagePickerPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('Camera roll permission not granted');
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
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
          await upsertUserProfile(auth.currentUser);
        }

        const updatedUser = { ...user, avatar: imageUri };
        setAvatar(imageUri);
        setUser(updatedUser);
        setIsUploading(false);
        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      if (!auth.currentUser) {
        Alert.alert('Error', 'No authenticated user found.');
        return;
      }

      await updateProfile(auth.currentUser, {
        displayName: editName.trim() || 'User',
        photoURL: avatar || null,
      });

      if (editEmail.trim() !== (auth.currentUser.email || '')) {
        await updateEmail(auth.currentUser, editEmail.trim());
      }

      await upsertUserProfile(auth.currentUser);

      const updatedUser = {
        ...user,
        name: editName.trim() || 'User',
        email: editEmail.trim(),
      };
      setUser(updatedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      const message =
        error?.code === 'auth/requires-recent-login'
          ? 'For security, please log out and log back in before changing your email.'
          : 'Failed to save profile';
      Alert.alert('Error', message);
    }
  };

  const handleCancelEdit = () => {
    setEditName(user.name);
    setEditEmail(user.email);
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/auth');
    } catch {
      Alert.alert('Error', 'Failed to logout');
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
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Text className="text-2xl font-bold text-foreground">Profile</Text>
        <View className="flex-row items-center gap-4">
          <ThemeToggle />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Profile Header */}
        <View className="items-center pt-8 pb-6">
          <View className="relative">
            <View className="w-32 h-32 rounded-full overflow-hidden border-4 border-card shadow-lg bg-muted items-center justify-center">
              {isUploading ? (
                <ActivityIndicator size="large" color="#8B5CF6" />
              ) : avatar ? (
                <Image
                  source={{ uri: avatar }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <User size={48} color="#A78BFA" />
              )}
            </View>
            {/* Camera Button */}
            <TouchableOpacity
              onPress={handleImageUpload}
              activeOpacity={0.8}
              className="absolute bottom-0 right-0 bg-primary p-2.5 rounded-full shadow-md border-2 border-card"
            >
              <Camera size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Name Display/Edit */}
          <View className="items-center mt-4 w-full px-8">
            {isEditing ? (
              <View className="w-full">
                <TextInput
                  className="text-2xl font-bold text-foreground text-center border-b border-border pb-1"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Name"
                />
              </View>
            ) : (
              <Text className="text-2xl font-bold text-foreground">{user.name}</Text>
            )}
          </View>

          {/* Edit/Save Actions */}
          <View className="flex-row items-center gap-3 mt-4">
            {isEditing ? (
              <>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  className="bg-secondary px-4 py-2 rounded-full flex-row items-center gap-2"
                >
                  <X size={16} color="#000" />
                  <Text className="text-secondary-foreground font-semibold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  className="bg-primary px-4 py-2 rounded-full flex-row items-center gap-2"
                >
                  <Check size={16} color="white" />
                  <Text className="text-primary-foreground font-semibold text-sm">Save</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="bg-muted px-4 py-2 rounded-full flex-row items-center gap-2 border border-border"
              >
                <Edit2 size={16} className="text-foreground" />
                <Text className="text-foreground font-semibold text-sm">Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Info Cards */}
        <View className="px-6 gap-4">
          {/* Name Card */}
          <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <View className="flex-row items-center gap-4">
              <View className="bg-primary/10 p-3 rounded-full">
                <User className="text-primary" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground uppercase font-semibold">Name</Text>
                {isEditing ? (
                  <TextInput
                    className="text-foreground font-medium mt-1 border-b border-border"
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Name"
                  />
                ) : (
                  <Text className="text-foreground font-medium mt-1">{user.name}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Email Card */}
          <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <View className="flex-row items-center gap-4">
              <View className="bg-primary/10 p-3 rounded-full">
                <Mail className="text-primary" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground uppercase font-semibold">Email</Text>
                {isEditing ? (
                  <TextInput
                    className="text-foreground font-medium mt-1 border-b border-border"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                ) : (
                  <Text className="text-foreground font-medium mt-1">{user.email}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
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
    </SafeAreaView>
  );
}
