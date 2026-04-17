import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  PencilLine,
  Search,
  Trash2,
  Video,
} from 'lucide-react-native';
import { auth } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useThemedAlert } from '@/components/themed-alert-provider';
import {
  getConversationInfo,
  hideConversationForUser,
  subscribeToConversationInfo,
  subscribeToConversationMembers,
  subscribeToMessages,
  subscribeToUserProfile,
  updateConversationNickname,
  updateGroupConversationDetails,
  type ChatMessage,
  type ConversationInfo,
  type FoundUser,
} from '@/lib/firestore';

const formatActiveStatus = (profile: FoundUser | null, now = Date.now()) => {
  if (!profile || profile.showActiveStatus === false || !profile.lastActiveAt) {
    return '';
  }

  const diffMs = now - profile.lastActiveAt;
  if (diffMs < 0) {
    return profile.isActive ? 'Active now' : '';
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (profile.isActive && diffMinutes < 2) {
    return 'Active now';
  }

  if (diffHours >= 24) {
    return '';
  }

  if (diffHours < 1) {
    const safeMinutes = Math.max(1, diffMinutes);
    return `Active ${safeMinutes} minute${safeMinutes === 1 ? '' : 's'} ago`;
  }

  return `Active ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
};

export default function ChatDetailsScreen() {
  const router = useRouter();
  const { id, userId } = useLocalSearchParams<{ id: string; userId?: string }>();
  const { showAlert, showConfirm } = useThemedAlert();
  const currentUser = auth.currentUser;
  const conversationId = id || '';
  const profileUserId = userId || '';

  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [profile, setProfile] = useState<FoundUser | null>(null);
  const [members, setMembers] = useState<FoundUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
  const [isSavingNicknames, setIsSavingNicknames] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNicknames, setShowNicknames] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [statusClock, setStatusClock] = useState(Date.now());

  const isGroupConversation = conversationInfo?.type === 'group';

  useEffect(() => {
    if (!conversationId || !currentUser) {
      setIsLoading(false);
      return;
    }

    let unsubscribeMessages = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribeConversation = () => {};
    let unsubscribeMembers = () => {};
    let isMounted = true;

    void getConversationInfo(conversationId)
      .then((info) => {
        if (!isMounted) return;
        setConversationInfo(info);
        setGroupNameDraft(info?.title || '');
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    unsubscribeConversation = subscribeToConversationInfo(conversationId, (info) => {
      if (!isMounted) return;
      setConversationInfo(info);
      setGroupNameDraft((currentDraft) => (currentDraft.trim().length > 0 ? currentDraft : info?.title || ''));
    });

    unsubscribeMessages = subscribeToMessages(conversationId, currentUser.uid, setMessages);

    if (profileUserId) {
      unsubscribeProfile = subscribeToUserProfile(profileUserId, setProfile);
    }

    unsubscribeMembers = subscribeToConversationMembers(conversationId, (nextMembers) => {
      if (!isMounted) return;
      setMembers(nextMembers);
    });

    return () => {
      isMounted = false;
      unsubscribeConversation();
      unsubscribeMessages();
      unsubscribeProfile();
      unsubscribeMembers();
    };
  }, [conversationId, currentUser, profileUserId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusClock(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!conversationInfo) {
      return;
    }

    setNicknameDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      const targetMembers =
        members.length > 0
          ? members
          : profileUserId
            ? [{ id: profileUserId, username: profile?.username || 'Chat' } as FoundUser]
            : [];

      targetMembers.forEach((member) => {
        if (!nextDrafts[member.id] || nextDrafts[member.id] === '') {
          nextDrafts[member.id] = infoNickname(conversationInfo, member.id);
        }
      });

      if (currentUser?.uid && !(currentUser.uid in nextDrafts)) {
        nextDrafts[currentUser.uid] = infoNickname(conversationInfo, currentUser.uid);
      }

      return nextDrafts;
    });
  }, [conversationInfo, members, profile?.username, profileUserId, currentUser?.uid]);

  const infoNickname = (info: ConversationInfo | null | undefined, memberId: string) =>
    info?.nicknamesByUserId?.[memberId] || '';

  const mediaMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !message.deletedForAll &&
          (message.type === 'image' || message.type === 'video') &&
          Boolean(message.mediaUrl)
      ),
    [messages]
  );

  const filteredMessages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return messages.filter(
      (message) =>
        !message.deletedForAll &&
        message.type === 'text' &&
        message.text.toLowerCase().includes(normalizedQuery)
    );
  }, [messages, searchQuery]);

  const displayName = isGroupConversation
    ? conversationInfo?.title || 'Group'
    : infoNickname(conversationInfo, profileUserId) || profile?.username || 'Chat';
  const displayAvatar = isGroupConversation ? conversationInfo?.avatar : profile?.avatar;
  const activeStatus = !isGroupConversation ? formatActiveStatus(profile, statusClock) : '';

  const nicknameMembers = isGroupConversation
    ? members
    : [
        ...(profile ? [profile] : []),
        ...(currentUser
          ? [
              {
                id: currentUser.uid,
                username: currentUser.displayName?.trim() || currentUser.email?.split('@')[0] || 'You',
                avatar: currentUser.photoURL || '',
              } as FoundUser,
            ]
          : []),
      ];

  const handleSaveNicknames = async () => {
    if (!currentUser || !conversationId) {
      return;
    }

    const changedEntries = nicknameMembers.filter((member) => {
      const saved = infoNickname(conversationInfo, member.id);
      const draft = (nicknameDrafts[member.id] || '').trim();
      return saved !== draft;
    });

    if (changedEntries.length === 0) {
      showAlert('No changes', 'Nicknames are already up to date.');
      return;
    }

    try {
      setIsSavingNicknames(true);
      for (const member of changedEntries) {
        await updateConversationNickname(
          conversationId,
          currentUser.uid,
          member.id,
          nicknameDrafts[member.id] || ''
        );
      }
      showAlert('Saved', 'Nicknames updated.');
    } catch {
      showAlert('Error', 'Failed to update nicknames.');
    } finally {
      setIsSavingNicknames(false);
    }
  };

  const handlePickGroupAvatar = async () => {
    if (!currentUser || !conversationId || !isGroupConversation) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setIsSavingGroup(true);
      const asset = result.assets[0];
      const upload = await uploadToCloudinary({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        folder: 'velora/group-avatars',
      });
      await updateGroupConversationDetails(conversationId, currentUser.uid, { avatar: upload.url });
    } catch {
      showAlert('Error', 'Failed to update the group photo.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleSaveGroupProfile = async () => {
    if (!currentUser || !conversationId || !isGroupConversation) {
      return;
    }

    try {
      setIsSavingGroup(true);
      await updateGroupConversationDetails(conversationId, currentUser.uid, {
        title: groupNameDraft,
      });
      showAlert('Saved', 'Group profile updated.');
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to update the group profile.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteChat = () => {
    if (!currentUser || !conversationId) {
      return;
    }

    showConfirm({
      title: 'Delete chat',
      message: 'This will remove the chat from your list only.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await hideConversationForUser(conversationId, currentUser.uid);
          router.replace('/(tabs)/friends');
        } catch {
          showAlert('Error', 'Failed to delete this chat.');
        }
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
        <View className="flex-row items-center border-b border-border px-5 py-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center">
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Chat Details</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
          <View className="items-center rounded-[28px] border border-border bg-card px-6 py-8">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (isGroupConversation) {
                  void handlePickGroupAvatar();
                  return;
                }

                if (profileUserId) {
                  router.push({ pathname: '/user/[id]', params: { id: profileUserId } });
                }
              }}
              className="items-center"
            >
              <View className="relative h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} className="h-full w-full" />
                ) : (
                  <Text className="text-3xl font-bold text-primary">
                    {displayName[0]?.toUpperCase() || '?'}
                  </Text>
                )}
                {isGroupConversation ? (
                  <TouchableOpacity
                    onPress={handlePickGroupAvatar}
                    className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary"
                    disabled={isSavingGroup}
                  >
                    <Camera size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text className="mt-4 text-2xl font-bold text-foreground">{displayName}</Text>
              {activeStatus ? <Text className="mt-1 text-sm text-muted-foreground">{activeStatus}</Text> : null}
              {isGroupConversation ? (
                <Text className="mt-1 text-sm text-muted-foreground">{members.length} members</Text>
              ) : null}
            </TouchableOpacity>
          </View>

          {isGroupConversation ? (
            <View className="mt-6 rounded-[28px] border border-border bg-card px-5 py-5">
              <TouchableOpacity
                onPress={() => setShowGroupProfile((value) => !value)}
                className="flex-row items-center justify-between"
                activeOpacity={0.85}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <PencilLine size={18} color="#8B5CF6" />
                  </View>
                  <Text className="text-lg font-bold text-foreground">Group Name</Text>
                </View>
                {showGroupProfile ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
              </TouchableOpacity>

              {showGroupProfile ? (
                <View className="mt-4 gap-4">
                  <View>
                    <Text className="mb-2 text-sm font-semibold text-foreground">Group name</Text>
                    <TextInput
                      value={groupNameDraft}
                      onChangeText={setGroupNameDraft}
                      placeholder="Group name"
                      placeholderTextColor="#9CA3AF"
                      className="rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground"
                      maxLength={80}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleSaveGroupProfile}
                    disabled={isSavingGroup}
                    className="items-center rounded-2xl bg-primary px-4 py-3"
                    style={{ opacity: isSavingGroup ? 0.75 : 1 }}
                  >
                    <Text className="font-semibold text-primary-foreground">
                      {isSavingGroup ? 'Saving...' : 'Save group profile'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6 rounded-[28px] border border-border bg-card px-5 py-5">
            <TouchableOpacity
              onPress={() => setShowNicknames((value) => !value)}
              className="flex-row items-center justify-between"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <PencilLine size={18} color="#8B5CF6" />
                </View>
                <Text className="text-lg font-bold text-foreground">Nicknames</Text>
              </View>
              {showNicknames ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
            </TouchableOpacity>

            {showNicknames ? (
              <View className="mt-4 gap-4">
                {nicknameMembers.map((member) => {
                  const label = member.id === currentUser?.uid ? 'Your nickname' : member.username;
                  const saved = infoNickname(conversationInfo, member.id);
                  return (
                    <View key={member.id}>
                      <Text className="mb-2 text-sm font-semibold text-foreground">{label}</Text>
                      <TextInput
                        value={nicknameDrafts[member.id] || ''}
                        onChangeText={(value) =>
                          setNicknameDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [member.id]: value,
                          }))
                        }
                        placeholder={`Nickname for ${member.username}`}
                        placeholderTextColor="#9CA3AF"
                        className="rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground"
                        maxLength={40}
                      />
                      {saved ? <Text className="mt-2 text-sm text-muted-foreground">Current: {saved}</Text> : null}
                    </View>
                  );
                })}

                <TouchableOpacity
                  onPress={handleSaveNicknames}
                  disabled={isSavingNicknames}
                  className="items-center rounded-2xl bg-primary px-4 py-3"
                  style={{ opacity: isSavingNicknames ? 0.75 : 1 }}
                >
                  <Text className="font-semibold text-primary-foreground">
                    {isSavingNicknames ? 'Saving...' : 'Save nicknames'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View className="mt-6 rounded-[28px] border border-border bg-card px-5 py-5">
            <TouchableOpacity
              onPress={() => setShowSearch((value) => !value)}
              className="flex-row items-center justify-between"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Search size={18} color="#8B5CF6" />
                </View>
                <Text className="text-lg font-bold text-foreground">Search Chat</Text>
              </View>
              {showSearch ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
            </TouchableOpacity>

            {showSearch ? (
              <View className="mt-4">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search messages"
                  placeholderTextColor="#9CA3AF"
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground"
                />

                {searchQuery.trim().length > 0 ? (
                  <View className="mt-4 gap-3">
                    {filteredMessages.length > 0 ? (
                      filteredMessages.slice(0, 20).map((message) => (
                        <View key={message.id} className="rounded-2xl bg-background px-4 py-3">
                          <Text className="text-sm text-foreground">{message.text}</Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-sm text-muted-foreground">No matching messages.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="mt-6 rounded-[28px] border border-border bg-card px-5 py-5">
            <TouchableOpacity
              onPress={() => setShowMedia((value) => !value)}
              className="flex-row items-center justify-between"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <ImageIcon size={18} color="#8B5CF6" />
                </View>
                <Text className="text-lg font-bold text-foreground">Media</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-sm text-muted-foreground">{mediaMessages.length}</Text>
                {showMedia ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
              </View>
            </TouchableOpacity>

            {showMedia ? (
              mediaMessages.length > 0 ? (
                <FlatList
                  data={mediaMessages}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={{ marginTop: 16 }}
                  columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setViewerMessage(item)}
                      className="relative flex-1 overflow-hidden bg-muted"
                      style={{ aspectRatio: 1 }}
                    >
                      {item.mediaUrl ? (
                        <Image source={{ uri: item.mediaUrl }} className="h-full w-full" resizeMode="cover" />
                      ) : null}
                      {item.type === 'video' ? (
                        <View className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1">
                          <Video size={12} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text className="mt-4 text-sm text-muted-foreground">No shared media yet.</Text>
              )
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleDeleteChat}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4"
          >
            <Trash2 size={18} color="#DC2626" />
            <Text className="font-semibold text-red-600">Delete Chat</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={Boolean(viewerMessage)} transparent animationType="fade" onRequestClose={() => setViewerMessage(null)}>
          <Pressable className="flex-1 bg-black/90" onPress={() => setViewerMessage(null)}>
            <View className="flex-1 items-center justify-center px-4">
              {viewerMessage?.mediaUrl ? (
                <Image source={{ uri: viewerMessage.mediaUrl }} className="h-[78%] w-full" resizeMode="contain" />
              ) : null}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
