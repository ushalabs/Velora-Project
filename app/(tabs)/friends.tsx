import React, { useEffect, useState } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  MessageCircle,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import { auth } from '@/lib/firebase';
import {
  acceptFriendRequest,
  declineFriendRequest,
  hideConversationForUser,
  subscribeToFriends,
  subscribeToGroups,
  subscribeToIncomingRequests,
  type FriendRequest,
  type FriendSummary,
  type GroupSummary,
} from '@/lib/firestore';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setFriends([]);
      setGroups([]);
      setIsLoading(false);
      return;
    }

    const unsubscribeFriends = subscribeToFriends(currentUser.uid, (nextFriends) => {
      setFriends(nextFriends);
      setIsLoading(false);
    });

    const unsubscribeGroups = subscribeToGroups(currentUser.uid, (nextGroups) => {
      setGroups(nextGroups);
      setIsLoading(false);
    });

    const unsubscribeRequests = subscribeToIncomingRequests(
      currentUser.uid,
      (requests) => {
        setIncomingRequests(requests);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeFriends();
      unsubscribeGroups();
      unsubscribeRequests();
    };
  }, []);

  const handleAccept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request);
    } catch {
      // quiet UI fallback
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
    } catch {
      // quiet UI fallback
    }
  };

  const handleHideConversation = (conversationId: string, label: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    Alert.alert(
      'Delete chat for you',
      `This will remove ${label} from your list only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await hideConversationForUser(conversationId, currentUser.uid);
            } catch {
              Alert.alert('Error', 'Failed to delete this chat for you.');
            }
          },
        },
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: FriendRequest }) => (
    <View className="mb-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/20">
          {item.senderAvatar ? (
            <Image source={{ uri: item.senderAvatar }} className="h-full w-full" />
          ) : (
            <Text className="text-xl font-bold text-primary">
              {item.senderUsername.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {item.senderUsername}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Sent you a friend request
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <TouchableOpacity
          onPress={() => handleAccept(item)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
        >
          <Check size={18} color="#FFFFFF" />
          <Text className="font-semibold text-primary-foreground">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDecline(item.id)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3"
        >
          <X size={18} color="#111827" />
          <Text className="font-semibold text-secondary-foreground">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriendItem = ({ item }: { item: FriendSummary }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({ pathname: '/chat/[id]', params: { id: item.id } })
      }
      onLongPress={() => handleHideConversation(item.conversationId, item.username)}
      className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 active:opacity-70"
    >
      <View className="relative">
        <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/20">
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} className="h-full w-full" />
          ) : (
            <Text className="text-xl font-bold text-primary">
              {item.username.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-green-500" />
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {item.username}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {item.lastMessageText || 'Start a conversation'}
        </Text>
      </View>

      <View className="items-center gap-2">
        <MessageCircle className="text-primary" size={22} />
        <Trash2 className="text-muted-foreground" size={16} />
      </View>
    </TouchableOpacity>
  );

  const renderGroupItem = ({ item }: { item: GroupSummary }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({ pathname: '/chat/[id]', params: { id: item.id } })
      }
      onLongPress={() => handleHideConversation(item.id, item.title)}
      className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 active:opacity-70"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <Users className="text-primary" size={24} />
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {item.title}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {item.lastMessageText || `${item.memberCount} members`}
        </Text>
      </View>

      <View className="items-center gap-2">
        <MessageCircle className="text-primary" size={22} />
        <Trash2 className="text-muted-foreground" size={16} />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-12 pt-20">
      <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="text-muted-foreground" size={48} />
      </View>
      <Text className="mb-3 text-xl font-bold text-foreground">
        No chats yet
      </Text>
      <Text className="mb-8 text-center text-base leading-relaxed text-muted-foreground">
        Start connecting, create a group, and keep your conversations organized.
      </Text>
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => router.push('/add-friend')}
          className="flex-row items-center gap-2 rounded-xl bg-primary px-5 py-3"
        >
          <UserPlus size={20} color="#FFFFFF" />
          <Text className="text-base font-semibold text-primary-foreground">
            Add Friend
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/create-group' })}
          className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-5 py-3"
        >
          <Users className="text-foreground" size={20} />
          <Text className="text-base font-semibold text-foreground">
            New Group
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      <View className="border-b border-border px-6 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-foreground">
              Velora
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {friends.length} {friends.length === 1 ? "friend" : "friends"} · {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push('/add-friend')}
              className="rounded-full border border-border bg-card px-4 py-2"
            >
              <Text className="font-semibold text-foreground">Add Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/create-group' })}
              className="rounded-full bg-primary px-4 py-2"
            >
              <Text className="font-semibold text-primary-foreground">New Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexGrow:
              friends.length === 0 &&
              incomingRequests.length === 0 &&
              groups.length === 0
                ? 1
                : 0,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 128,
          }}
          showsVerticalScrollIndicator={false}
        >
          {incomingRequests.length > 0 && (
            <View className="mb-8">
              <Text className="mb-4 text-lg font-bold text-foreground">
                Friend Requests
              </Text>
              <FlatList
                data={incomingRequests}
                renderItem={renderRequestItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {groups.length > 0 ? (
            <View className="mb-8">
              <Text className="mb-4 text-lg font-bold text-foreground">
                Groups
              </Text>
              <FlatList
                data={groups}
                renderItem={renderGroupItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          ) : null}

          {friends.length > 0 ? (
            <View>
              <Text className="mb-4 text-lg font-bold text-foreground">
                Direct Messages
              </Text>
              <FlatList
                data={friends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.conversationId}
                scrollEnabled={false}
              />
            </View>
          ) : incomingRequests.length === 0 && groups.length === 0 ? (
            renderEmptyState()
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
