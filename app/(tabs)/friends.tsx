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
  Users,
  UserPlus,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import { auth } from '@/lib/firebase';
import ThemedActionSheet, { type ThemedActionSheetOption } from '@/components/themed-action-sheet';
import {
  acceptFriendRequest,
  acceptMessageRequest,
  declineFriendRequest,
  declineMessageRequest,
  hideConversationForUser,
  subscribeToDirectMessages,
  subscribeToGroups,
  subscribeToIncomingMessageRequests,
  subscribeToIncomingRequests,
  unfriendConversation,
  type FriendRequest,
  type GroupSummary,
  type MessageRequest,
  type FriendSummary,
} from '@/lib/firestore';

export default function FriendsScreen() {
  const [directMessages, setDirectMessages] = useState<FriendSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [incomingMessageRequests, setIncomingMessageRequests] = useState<MessageRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    title: string;
    message?: string;
    options: ThemedActionSheetOption[];
  } | null>(null);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setDirectMessages([]);
      setGroups([]);
      setIncomingRequests([]);
      setIncomingMessageRequests([]);
      setIsLoading(false);
      return;
    }

    const unsubscribeDirectMessages = subscribeToDirectMessages(currentUser.uid, (nextDirectMessages) => {
      setDirectMessages(nextDirectMessages);
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

    const unsubscribeMessageRequests = subscribeToIncomingMessageRequests(
      currentUser.uid,
      (requests) => {
        setIncomingMessageRequests(requests);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeDirectMessages();
      unsubscribeGroups();
      unsubscribeRequests();
      unsubscribeMessageRequests();
    };
  }, []);

  const handleAccept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request);
    } catch {
      Alert.alert('Error', 'Failed to accept this friend request.');
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
    } catch {
      Alert.alert('Error', 'Failed to decline this friend request.');
    }
  };

  const handleAcceptMessageRequest = async (request: MessageRequest) => {
    try {
      await acceptMessageRequest(request);
    } catch {
      Alert.alert('Error', 'Failed to accept this message request.');
    }
  };

  const handleDeclineMessageRequest = async (requestId: string) => {
    try {
      await declineMessageRequest(requestId);
    } catch {
      Alert.alert('Error', 'Failed to decline this message request.');
    }
  };

  const handleHideConversation = (conversationId: string, label: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setActionSheetConfig({
      title: label,
      message: 'This will remove this chat from your list only.',
      options: [
        {
          label: 'Delete chat for me',
          destructive: true,
          onPress: async () => {
            try {
              await hideConversationForUser(conversationId, currentUser.uid);
            } catch {
              Alert.alert('Error', 'Failed to delete this chat for you.');
            }
          },
        },
      ],
    });
  };

  const handleDirectMessageActions = (conversation: FriendSummary) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setActionSheetConfig({
      title: conversation.nickname?.trim() || conversation.username,
      message: conversation.isFriend
        ? 'Choose what you want to do with this friend.'
        : 'Choose what you want to do with this DM.',
      options: [
        {
          label: 'Delete chat for me',
          onPress: async () => {
            try {
              await hideConversationForUser(conversation.conversationId, currentUser.uid);
            } catch {
              Alert.alert('Error', 'Failed to delete this chat for you.');
            }
          },
        },
        ...(conversation.isFriend
          ? [
              {
                label: 'Remove friend',
                destructive: true,
                onPress: async () => {
                  try {
                    await unfriendConversation(conversation.conversationId, currentUser.uid);
                  } catch {
                    Alert.alert('Error', 'Failed to remove this friend.');
                  }
                },
              },
            ]
          : []),
      ],
    });
  };

  const renderAvatar = (username: string, avatar?: string) => (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/20">
      {avatar ? (
        <Image source={{ uri: avatar }} className="h-full w-full" />
      ) : (
        <Text className="text-xl font-bold text-primary">
          {username.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const isSameDay = date.toDateString() === now.toDateString();

    if (isSameDay) {
      return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

const renderFriendRequestItem = ({ item }: { item: FriendRequest }) => (
    <View className="mb-4 py-2">
      <View className="flex-row items-center gap-4">
        {renderAvatar(item.senderUsername, item.senderAvatar)}
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

const renderMessageRequestItem = ({ item }: { item: MessageRequest }) => (
    <View className="mb-4 py-2">
      <View className="flex-row items-center gap-4">
        {renderAvatar(item.senderUsername, item.senderAvatar)}
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {item.senderUsername}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Sent you a message request
          </Text>
          {item.initialMessage ? (
            <Text className="mt-2 text-sm text-foreground">
              {item.initialMessage}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <TouchableOpacity
          onPress={() => handleAcceptMessageRequest(item)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
        >
          <Check size={18} color="#FFFFFF" />
          <Text className="font-semibold text-primary-foreground">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeclineMessageRequest(item.id)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3"
        >
          <X size={18} color="#111827" />
          <Text className="font-semibold text-secondary-foreground">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDirectMessageItem = ({ item }: { item: FriendSummary }) => {
    const currentUserId = auth.currentUser?.uid || '';
    const sentByMe = Boolean(currentUserId && item.lastMessageSenderId === currentUserId);
    const seenByOther = sentByMe && (item.seenByOtherAt || 0) >= item.updatedAt;
    const displayName = item.nickname?.trim() || item.username;
    const now = Date.now();
    const isActuallyActive =
      item.showActiveStatus !== false &&
      Boolean(item.isActive) &&
      Boolean(item.lastActiveAt) &&
      now - (item.lastActiveAt || 0) < 90000;
    const previewText = item.lastMessageText || 'Start a conversation';
    const previewLabel =
      sentByMe && previewText !== 'Start a conversation'
        ? `You: ${previewText}`
        : previewText;

    return (
    <TouchableOpacity
      onPress={() =>
        router.push({ pathname: '/chat/[id]', params: { id: item.id } })
      }
      onLongPress={() => handleDirectMessageActions(item)}
      className="mb-1 flex-row items-center gap-4 px-1 py-3 active:opacity-70"
    >
      <View className="relative">
        {renderAvatar(displayName, item.avatar)}
        {isActuallyActive ? (
          <View className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-green-500" />
        ) : null}
      </View>

      <View className="flex-1">
        <Text className={`text-base font-semibold ${item.unreadCount > 0 ? 'text-foreground' : 'text-foreground'}`}>
          {displayName}
        </Text>
        {!item.isFriend ? (
          <Text className="text-xs text-muted-foreground">DM only</Text>
        ) : null}
        <Text
          numberOfLines={1}
          className={`mt-0.5 text-sm ${
            item.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
          }`}
        >
          {previewLabel}
        </Text>
      </View>

      <View className="ml-3 min-w-[52px] items-end justify-center">
        <Text
          className={`text-xs ${
            item.unreadCount > 0 ? 'font-semibold text-[#8B5CF6]' : 'text-muted-foreground'
          }`}
        >
          {formatChatTime(item.updatedAt)}
        </Text>

        {item.unreadCount > 0 ? (
          <View className="mt-2 h-7 min-w-[28px] items-center justify-center rounded-full bg-[#8B5CF6] px-2">
            <Text className="text-center text-xs font-black text-white">
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        ) : seenByOther ? (
          <View className="mt-2 h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-primary/20">
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} className="h-full w-full" />
            ) : (
              <Text className="text-[10px] font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
    );
  };

  const renderGroupItem = ({ item }: { item: GroupSummary }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({ pathname: '/chat/[id]', params: { id: item.id } })
      }
      onLongPress={() => handleHideConversation(item.id, item.title)}
      className="mb-1 flex-row items-center gap-4 px-1 py-3 active:opacity-70"
    >
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/15">
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} className="h-full w-full" />
        ) : (
          <Users className="text-primary" size={24} />
        )}
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {item.title}
        </Text>
        <Text
          numberOfLines={1}
          className={`text-sm ${
            item.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
          }`}
        >
          {item.lastMessageText || `${item.memberCount} members`}
        </Text>
      </View>

      <View className="ml-3 min-w-[52px] items-end justify-center">
        <Text
          className={`text-xs ${
            item.unreadCount > 0 ? 'font-semibold text-[#8B5CF6]' : 'text-muted-foreground'
          }`}
        >
          {formatChatTime(item.updatedAt)}
        </Text>

        {item.unreadCount > 0 ? (
          <View className="mt-2 h-7 min-w-[28px] items-center justify-center rounded-full bg-[#8B5CF6] px-2">
            <Text className="text-center text-xs font-black text-white">
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        ) : null}
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
        Send a friend request, start a message request, or create a group.
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
    <>
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
              directMessages.length === 0 &&
              incomingRequests.length === 0 &&
              incomingMessageRequests.length === 0 &&
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
                renderItem={renderFriendRequestItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {incomingMessageRequests.length > 0 && (
            <View className="mb-8">
              <Text className="mb-4 text-lg font-bold text-foreground">
                Message Requests
              </Text>
              <FlatList
                data={incomingMessageRequests}
                renderItem={renderMessageRequestItem}
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

          {directMessages.length > 0 ? (
            <View>
              <Text className="mb-4 text-lg font-bold text-foreground">
                Direct Messages
              </Text>
              <FlatList
                data={directMessages}
                renderItem={renderDirectMessageItem}
                keyExtractor={(item) => item.conversationId}
                scrollEnabled={false}
              />
            </View>
          ) : incomingRequests.length === 0 &&
            incomingMessageRequests.length === 0 &&
            groups.length === 0 ? (
            renderEmptyState()
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
      <ThemedActionSheet
        visible={Boolean(actionSheetConfig)}
        title={actionSheetConfig?.title || ''}
        message={actionSheetConfig?.message}
        options={actionSheetConfig?.options || []}
        onClose={() => setActionSheetConfig(null)}
      />
    </>
  );
}
