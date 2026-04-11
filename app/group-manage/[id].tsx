import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Plus, UserMinus } from 'lucide-react-native';
import { auth } from '@/lib/firebase';
import {
  addMembersToGroup,
  leaveGroupConversation,
  removeMemberFromGroup,
  subscribeToConversationInfo,
  subscribeToConversationMembers,
  subscribeToFriends,
  type ConversationInfo,
  type FoundUser,
  type FriendSummary,
} from '@/lib/firestore';

export default function GroupManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<ConversationInfo | null>(null);
  const [members, setMembers] = useState<FoundUser[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = auth.currentUser;
  const isAdmin = Boolean(currentUser && group?.adminIds.includes(currentUser.uid));

  useEffect(() => {
    if (!id) return;

    const unsubscribeGroup = subscribeToConversationInfo(id, (nextGroup) => {
      setGroup(nextGroup);
      setIsLoading(false);
    });

    const unsubscribeMembers = subscribeToConversationMembers(id, (nextMembers) => {
      setMembers(nextMembers);
      setIsLoading(false);
    });

    let unsubscribeFriends = () => {};
    if (currentUser) {
      unsubscribeFriends = subscribeToFriends(currentUser.uid, (nextFriends) => {
        setFriends(nextFriends);
        setIsLoading(false);
      });
    }

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeFriends();
    };
  }, [currentUser, id]);

  const availableFriends = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.id));
    return friends.filter((friend) => !memberIds.has(friend.id));
  }, [friends, members]);

  const handleAddMember = async (friendId: string) => {
    if (!currentUser || !id) return;

    try {
      await addMembersToGroup(id, currentUser.uid, [friendId]);
    } catch {
      Alert.alert('Error', 'Failed to add this member.');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentUser || !id) return;

    try {
      await removeMemberFromGroup(id, currentUser.uid, memberId);
    } catch {
      Alert.alert('Error', 'Failed to remove this member.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUser || !id) return;

    try {
      await leaveGroupConversation(id, currentUser.uid);
      router.replace('/(tabs)/friends');
    } catch {
      Alert.alert('Error', 'Failed to leave this group.');
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
        <Text className="text-xl font-bold text-foreground">Manage Group</Text>
        <View className="w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 128 }}
          ListHeaderComponent={
            <View className="mb-6">
              <Text className="text-2xl font-bold text-foreground">
                {group?.title || 'Group'}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {isAdmin ? 'You are the admin of this group.' : 'Only the admin can add or remove members.'}
              </Text>

              {isAdmin && availableFriends.length > 0 ? (
                <View className="mt-6">
                  <Text className="mb-3 text-lg font-bold text-foreground">Add Friends</Text>
                  {availableFriends.map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      onPress={() => handleAddMember(friend.id)}
                      className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                    >
                      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                        {friend.avatar ? (
                          <Image source={{ uri: friend.avatar }} className="h-full w-full" />
                        ) : (
                          <Text className="text-lg font-bold text-primary">
                            {friend.username.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text className="flex-1 text-base font-semibold text-foreground">
                        {friend.username}
                      </Text>
                      <View className="rounded-full bg-primary/10 p-2">
                        <Plus className="text-primary" size={18} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text className="mb-3 mt-2 text-lg font-bold text-foreground">Members</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} className="h-full w-full" />
                ) : (
                  <Text className="text-lg font-bold text-primary">
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  {item.username}
                </Text>
                {group?.adminIds.includes(item.id) ? (
                  <Text className="text-sm text-primary">Admin</Text>
                ) : null}
              </View>

              {isAdmin && item.id !== currentUser?.uid ? (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item.id)}
                  className="rounded-full bg-destructive/10 p-2"
                >
                  <UserMinus className="text-destructive" size={18} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            <View className="pt-4">
              <TouchableOpacity
                onPress={handleLeaveGroup}
                className="rounded-2xl border border-destructive bg-destructive/10 px-4 py-4"
              >
                <Text className="text-center font-semibold text-destructive">
                  Leave Group
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
