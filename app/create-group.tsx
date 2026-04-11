import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { auth } from '@/lib/firebase';
import {
  createGroupConversation,
  subscribeToFriends,
  type FriendSummary,
} from '@/lib/firestore';

export default function CreateGroupScreen() {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToFriends(currentUser.uid, (nextFriends) => {
      setFriends(nextFriends);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const toggleSelection = (friendId: string) => {
    setSelectedIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  };

  const handleCreateGroup = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You need to sign in again.');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Missing name', 'Please enter a group name.');
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert('Add members', 'Please choose at least one friend.');
      return;
    }

    try {
      setIsSaving(true);
      const conversationId = await createGroupConversation(currentUser, {
        name: groupName.trim(),
        memberIds: selectedIds,
      });

      router.replace({ pathname: '/chat/[id]', params: { id: conversationId } });
    } catch {
      Alert.alert('Error', 'Failed to create the group.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
        >
          <ArrowLeft className="text-foreground" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Create Group</Text>
        <View className="w-10" />
      </View>

      <View className="p-6">
        <Text className="mb-2 font-semibold text-foreground">Group name</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Enter a group name"
          placeholderTextColor="#9CA3AF"
          className="rounded-2xl border border-border bg-input px-4 py-4 text-foreground"
        />
      </View>

      <View className="px-6 pb-3">
        <Text className="font-semibold text-foreground">
          Select friends ({selectedIds.length})
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 128 }}
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                onPress={() => toggleSelection(item.id)}
                className={`mb-3 flex-row items-center gap-4 rounded-2xl border p-4 ${
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} className="h-full w-full" />
                  ) : (
                    <Text className="text-xl font-bold text-primary">
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {item.username}
                  </Text>
                </View>

                <View
                  className={`h-7 w-7 items-center justify-center rounded-full ${
                    selected ? 'bg-primary' : 'border border-border bg-background'
                  }`}
                >
                  {selected ? <Check size={16} color="#FFFFFF" /> : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="px-6 pt-20">
              <Text className="text-center text-muted-foreground">
                Add some friends first, then you can create a group.
              </Text>
            </View>
          }
        />
      )}

      <View className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-6 py-4">
        <TouchableOpacity
          onPress={handleCreateGroup}
          disabled={isSaving}
          className="rounded-2xl bg-primary py-4"
          style={{ opacity: isSaving ? 0.7 : 1 }}
        >
          <Text className="text-center text-base font-semibold text-primary-foreground">
            {isSaving ? 'Creating group...' : 'Create Group'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
