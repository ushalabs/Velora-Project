import React, { useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, ArrowLeft, UserPlus, Check, AlertCircle, X, MessageCircle } from 'lucide-react-native';
import { router } from "expo-router";
import { auth } from '@/lib/firebase';
import {
  createFriendRequest,
  createMessageRequest,
  findUserByUsername,
  getUserConnectionState,
  type FoundUser,
  type UserConnectionState,
} from '@/lib/firestore';
import { sendUserPushNotification } from '@/lib/push-api';
import { useThemedAlert } from '@/components/themed-alert-provider';

type SearchState =
  | "idle"
  | "searching"
  | "result"
  | "not-found"
  | "yourself";

export default function AddFriendScreen() {
  const { showAlert } = useThemedAlert();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [connectionState, setConnectionState] = useState<UserConnectionState | null>(null);
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessageRequest, setIsSendingMessageRequest] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  React.useEffect(() => {
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

  const handleSearch = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      showAlert('Error', 'You need to sign in again.');
      return;
    }

      if (!searchQuery.trim()) {
      setSearchState("idle");
      setFoundUser(null);
      setConnectionState(null);
      return;
    }

    setSearchState("searching");

    try {
      const user = await findUserByUsername(searchQuery);

      if (!user) {
        setSearchState("not-found");
        setFoundUser(null);
        setConnectionState(null);
        return;
      }

      if (user.id === currentUser.uid) {
        setSearchState("yourself");
        setFoundUser(null);
        setConnectionState(null);
        return;
      }

      const nextConnectionState = await getUserConnectionState(currentUser.uid, user.id);
      setFoundUser(user);
      setConnectionState(nextConnectionState);
      setSearchState("result");
    } catch {
      showAlert('Error', 'Failed to search for that user.');
      setSearchState("idle");
    }
  };

  const handleAddFriend = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !foundUser) {
      showAlert('Error', 'Missing user information. Please try again.');
      return;
    }

    try {
      await createFriendRequest(currentUser, foundUser);
      await sendUserPushNotification({
        recipientUserIds: [foundUser.id],
        title: `${currentUser.displayName?.trim() || 'Someone'} sent you a friend request`,
        body: 'Open Velora to accept or decline it.',
        data: {
          screen: 'friends',
          type: 'friend-request',
        },
      }).catch(() => {});
      setConnectionState((currentState) =>
        currentState
          ? {
              ...currentState,
              outgoingFriendRequest: true,
            }
          : currentState
      );
    } catch {
      showAlert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const handleDirectMessage = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !foundUser) {
      showAlert('Error', 'Missing user information. Please try again.');
      return;
    }

    try {
      setIsSendingMessageRequest(true);
      await createMessageRequest(currentUser, foundUser, messageDraft);
      await sendUserPushNotification({
        recipientUserIds: [foundUser.id],
        title: `${currentUser.displayName?.trim() || 'Someone'} sent you a message request`,
        body: 'Open Velora to accept or decline it.',
        data: {
          screen: 'friends',
          type: 'message-request',
        },
      }).catch(() => {});
      setConnectionState((currentState) =>
        currentState
          ? {
              ...currentState,
              outgoingMessageRequest: true,
            }
          : currentState
      );
      setMessageDraft('');
      setShowMessageComposer(false);
    } catch {
      showAlert('Error', 'Failed to send message request. Please try again.');
    } finally {
      setIsSendingMessageRequest(false);
    }
  };

  const openChat = () => {
    if (foundUser) {
      router.push({ pathname: '/chat/[id]', params: { id: foundUser.id } });
    }
  };

  const openProfile = () => {
    if (foundUser) {
      router.push({ pathname: '/user/[id]', params: { id: foundUser.id } });
    }
  };

  const renderAvatar = (user: FoundUser | null) => (
    <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/20">
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} className="h-full w-full" />
      ) : (
        <Text className="text-2xl font-bold text-primary">
          {user?.username.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );

  const renderSearchResult = () => {
    switch (searchState) {
      case "searching":
        return (
          <View className="flex-1 items-center justify-center pt-20">
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text className="mt-4 text-muted-foreground">Searching...</Text>
          </View>
        );

      case "result":
        return (
          <View className="pt-8">
            <Text className="mb-4 px-6 font-semibold text-foreground">
              User Found
            </Text>
            <View className="mx-6 rounded-2xl border border-border bg-card p-5">
              <TouchableOpacity
                onPress={openProfile}
                activeOpacity={0.85}
                className="flex-row items-center gap-4"
              >
                {renderAvatar(foundUser)}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {foundUser?.username}
                  </Text>
                  {connectionState?.isFriend ? (
                    <View className="mt-1 flex-row items-center gap-2">
                      <Check className="text-green-500" size={16} />
                      <Text className="text-sm text-green-500">
                        Friend
                      </Text>
                    </View>
                  ) : connectionState?.hasDirectMessage ? (
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Already in your DMs
                    </Text>
                  ) : connectionState?.incomingFriendRequest ? (
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Sent you a friend request
                    </Text>
                  ) : connectionState?.outgoingFriendRequest ? (
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Friend request already sent
                    </Text>
                  ) : connectionState?.incomingMessageRequest ? (
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Sent you a message request
                    </Text>
                  ) : connectionState?.outgoingMessageRequest ? (
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Message request already sent
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View className="mt-5 gap-3">
                {connectionState?.hasDirectMessage || connectionState?.isFriend ? (
                  <TouchableOpacity
                    onPress={openChat}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3"
                  >
                    <Text className="text-base font-semibold text-secondary-foreground">
                      Open Chat
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {!connectionState?.isFriend ? (
                  <TouchableOpacity
                    onPress={handleAddFriend}
                    disabled={Boolean(connectionState?.outgoingFriendRequest || connectionState?.incomingFriendRequest)}
                    className={`flex-row items-center justify-center gap-2 rounded-xl px-6 py-3 ${
                      connectionState?.outgoingFriendRequest || connectionState?.incomingFriendRequest
                        ? 'bg-muted'
                        : 'bg-primary'
                    }`}
                  >
                    <UserPlus size={20} color="#FFFFFF" />
                    <Text className="text-base font-semibold text-primary-foreground">
                      {connectionState?.incomingFriendRequest
                        ? 'Review Friend Request'
                        : connectionState?.outgoingFriendRequest
                          ? 'Friend Request Sent'
                          : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {!connectionState?.hasDirectMessage ? (
                  <TouchableOpacity
                    onPress={() => setShowMessageComposer(true)}
                    disabled={Boolean(connectionState?.outgoingMessageRequest || connectionState?.incomingMessageRequest)}
                    className={`flex-row items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 ${
                      connectionState?.outgoingMessageRequest || connectionState?.incomingMessageRequest
                        ? 'bg-muted'
                        : 'bg-card'
                    }`}
                  >
                    <MessageCircle size={20} color="#111827" />
                    <Text className="text-base font-semibold text-foreground">
                      {connectionState?.incomingMessageRequest
                        ? 'Review Message Request'
                        : connectionState?.outgoingMessageRequest
                          ? 'Message Request Sent'
                          : 'Direct Message'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {connectionState?.incomingFriendRequest || connectionState?.incomingMessageRequest ? (
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/friends')}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3"
                  >
                    <Text className="text-base font-semibold text-secondary-foreground">
                      Review Requests
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        );

      case "yourself":
        return (
          <View className="pt-8">
            <View className="mx-6 rounded-2xl border border-border bg-card p-6">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="text-muted-foreground" size={32} />
                </View>
                <Text className="mb-2 text-lg font-bold text-foreground">
                  Can&apos;t add yourself
                </Text>
                <Text className="text-center text-sm leading-relaxed text-muted-foreground">
                  You can&apos;t add yourself as a friend. Try searching for
                  someone else.
                </Text>
              </View>
            </View>
          </View>
        );

      case "not-found":
        return (
          <View className="pt-8">
            <View className="mx-6 rounded-2xl border border-border bg-card p-6">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <X className="text-muted-foreground" size={32} />
                </View>
                <Text className="mb-2 text-lg font-bold text-foreground">
                  User not found
                </Text>
                <Text className="text-center text-sm leading-relaxed text-muted-foreground">
                  We couldn&apos;t find a user with username &quot;{searchQuery}
                  &quot;. Check the spelling and try again.
                </Text>
              </View>
            </View>
          </View>
        );

      case "idle":
      default:
        return (
          <View className="flex-1 items-center justify-center px-12 pt-20">
            <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Search className="text-muted-foreground" size={48} />
            </View>
              <Text className="mb-3 text-center text-xl font-bold text-foreground">
              Find People
              </Text>
              <Text className="text-center text-base leading-relaxed text-muted-foreground">
              Search by exact username to send a friend request or a message request.
              </Text>
          </View>
        );
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
        <Text className="text-xl font-bold text-foreground">Add Friend</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 128 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-6">
          <Text className="mb-3 font-semibold text-foreground">
            Search by username
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 flex-row items-center rounded-xl border border-border bg-input px-4">
              <Search className="mr-3 text-muted-foreground" size={20} />
              <TextInput
                className="flex-1 py-3 text-foreground"
                placeholder="Enter username"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X className="text-muted-foreground" size={18} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              className="items-center justify-center rounded-xl bg-primary px-5"
              disabled={!searchQuery.trim()}
            >
              <Search size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {renderSearchResult()}
      </ScrollView>

      <Modal
        visible={showMessageComposer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageComposer(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setShowMessageComposer(false)}>
          <Pressable className="mt-auto rounded-t-[32px] bg-background px-6 pb-10 pt-6">
              <View className="mb-5 flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-foreground">Direct Message</Text>
                <TouchableOpacity
                  onPress={() => setShowMessageComposer(false)}
                  className="rounded-full bg-secondary px-3 py-2"
                >
                  <Text className="font-semibold text-foreground">Close</Text>
                </TouchableOpacity>
              </View>

              <Text className="mb-3 text-sm text-muted-foreground">
                Send the first message with your request to {foundUser?.username}.
              </Text>

              <View
                style={{
                  marginBottom: keyboardHeight > 0 ? Math.max(keyboardHeight - 24, 0) : 0,
                }}
              >
                <TextInput
                  value={messageDraft}
                  onChangeText={setMessageDraft}
                  placeholder="Write your first message..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={300}
                  className="min-h-[120px] rounded-2xl border border-border bg-input px-4 py-4 text-base text-foreground"
                />

                <TouchableOpacity
                  onPress={handleDirectMessage}
                  disabled={isSendingMessageRequest || !messageDraft.trim()}
                  className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
                    isSendingMessageRequest || !messageDraft.trim() ? 'bg-muted' : 'bg-primary'
                  }`}
                >
                  <MessageCircle
                    size={18}
                    color={isSendingMessageRequest || !messageDraft.trim() ? '#9CA3AF' : '#FFFFFF'}
                  />
                  <Text
                    className={`font-semibold ${
                      isSendingMessageRequest || !messageDraft.trim()
                        ? 'text-muted-foreground'
                        : 'text-primary-foreground'
                    }`}
                  >
                    {isSendingMessageRequest ? 'Sending...' : 'Send Message Request'}
                  </Text>
                </TouchableOpacity>
              </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
