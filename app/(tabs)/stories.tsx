import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, Heart, Image as ImageIcon, Plus, Trash2, Type, Video as VideoIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import {
  cleanupExpiredStoriesForUser,
  createStory,
  deleteStory,
  getConversationId,
  markStorySeen,
  notifyStoryReply,
  sendMessage,
  subscribeToFriends,
  subscribeToVisibleStories,
  subscribeToUserProfile,
  toggleStoryLike,
  updateStoryPrivacy,
  type FriendSummary,
  type FoundUser,
  type StoryFeedEntry,
  type StoryItem,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { sendMessagePushNotification } from '@/lib/push-api';

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
    videoPlayer.play();
  });

  return <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls={false} />;
}

export default function StoriesScreen() {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const [currentUserProfile, setCurrentUserProfile] = useState<FoundUser | null>(null);
  const [feeds, setFeeds] = useState<StoryFeedEntry[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [replyText, setReplyText] = useState('');
  const [viewerFeed, setViewerFeed] = useState<StoryFeedEntry | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showPrivacyEditor, setShowPrivacyEditor] = useState(false);
  const [isSavingStoryPrivacy, setIsSavingStoryPrivacy] = useState<string | null>(null);
  const [showStoryLikes, setShowStoryLikes] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthProfile((user) => {
      setCurrentUserId(user?.uid || null);
    });

    return unsubscribe;
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
    if (!currentUserId) {
      setFeeds([]);
      setFriends([]);
      setCurrentUserProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void cleanupExpiredStoriesForUser(currentUserId).catch(() => {});

    const unsubscribeFriends = subscribeToFriends(currentUserId, (nextFriends) => {
      setFriends(nextFriends);
    });

    const unsubscribeStories = subscribeToVisibleStories(currentUserId, (nextFeeds) => {
      setFeeds(nextFeeds);
      setIsLoading(false);
    });

    return () => {
      unsubscribeFriends();
      unsubscribeStories();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserProfile(null);
      return;
    }

    const unsubscribeProfile = subscribeToUserProfile(currentUserId, setCurrentUserProfile);
    return unsubscribeProfile;
  }, [currentUserId]);

  const ownFeed = useMemo(
    () => feeds.find((feed) => feed.isOwn) || null,
    [feeds]
  );
  const friendFeeds = useMemo(
    () => feeds.filter((feed) => !feed.isOwn),
    [feeds]
  );
  const activeStory = viewerFeed?.stories[viewerIndex] || null;

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeStory) {
      return;
    }

    void markStorySeen(currentUser, activeStory.id).catch(() => {});
  }, [activeStory]);

  const closeComposer = () => {
    setIsCreating(false);
    setTextDraft('');
  };

  const handleCreateTextStory = async () => {
    const currentUser = auth.currentUser;
    const text = textDraft.trim();

    if (!currentUser || !text) {
      return;
    }

    try {
      setIsUploading(true);
      await createStory(currentUser, {
        type: 'text',
        text,
      });
      closeComposer();
    } catch {
      Alert.alert('Error', 'Failed to post your story.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateMediaStory = async (type: 'image' | 'video') => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow media access to upload stories.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          type === 'image'
            ? ['images']
            : ['videos'],
        allowsEditing: type === 'image',
        quality: 0.85,
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
        folder: type === 'image' ? 'velora/stories/images' : 'velora/stories/videos',
      });

      await createStory(currentUser, {
        type,
        mediaUrl: upload.url,
      });
    } catch {
      Alert.alert('Error', `Failed to upload your ${type} story.`);
    } finally {
      setIsUploading(false);
      closeComposer();
    }
  };

  const openFeed = (feed: StoryFeedEntry, storyIndex = 0) => {
    setViewerFeed(feed);
    setViewerIndex(storyIndex);
    setReplyText('');
  };

  const showNextStory = () => {
    if (!viewerFeed) return;

    if (viewerIndex < viewerFeed.stories.length - 1) {
      setViewerIndex((currentIndex) => currentIndex + 1);
      return;
    }

    const currentFeedIndex = feeds.findIndex((feed) => feed.ownerId === viewerFeed.ownerId);
    const nextFeed = feeds[currentFeedIndex + 1];

    if (nextFeed) {
      setViewerFeed(nextFeed);
      setViewerIndex(0);
      return;
    }

    setViewerFeed(null);
    setViewerIndex(0);
  };

  const showPreviousStory = () => {
    if (!viewerFeed) return;

    if (viewerIndex > 0) {
      setViewerIndex((currentIndex) => currentIndex - 1);
      return;
    }

    const currentFeedIndex = feeds.findIndex((feed) => feed.ownerId === viewerFeed.ownerId);
    const previousFeed = feeds[currentFeedIndex - 1];

    if (previousFeed) {
      setViewerFeed(previousFeed);
      setViewerIndex(previousFeed.stories.length - 1);
      return;
    }
  };

  const handleDeleteActiveStory = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeStory || activeStory.ownerId !== currentUser.uid) {
      return;
    }

    try {
      await deleteStory(activeStory.id, currentUser.uid);
      const remainingStories = viewerFeed?.stories.filter((story) => story.id !== activeStory.id) || [];

      if (remainingStories.length === 0) {
        setViewerFeed(null);
        setViewerIndex(0);
        return;
      }

      setViewerFeed((currentFeed) =>
        currentFeed
          ? {
              ...currentFeed,
              stories: remainingStories,
              latestAt: remainingStories[remainingStories.length - 1]?.createdAt || currentFeed.latestAt,
            }
          : currentFeed
      );
      setViewerIndex((currentIndex) => Math.min(currentIndex, remainingStories.length - 1));
    } catch {
      Alert.alert('Error', 'Failed to delete this story.');
    }
  };

  const handleReplyToStory = async () => {
    const currentUser = auth.currentUser;
    const message = replyText.trim();

    if (!currentUser || !viewerFeed || viewerFeed.isOwn || !message) {
      return;
    }

    try {
      setReplyText('');
      Keyboard.dismiss();
      await sendMessage(currentUser, viewerFeed.ownerId, message, {
        type: 'story',
        ownerId: viewerFeed.ownerId,
        ownerUsername: viewerFeed.username,
        storyType: activeStory?.type || 'text',
        storyText: activeStory?.text || '',
        storyMediaUrl: activeStory?.mediaUrl || '',
      });
      if (activeStory) {
        await notifyStoryReply(currentUser, viewerFeed.ownerId, activeStory.id, message).catch(() => {});
      }
      void sendMessagePushNotification({
        conversationId: getConversationId(currentUser.uid, viewerFeed.ownerId),
        senderName: currentUser.displayName?.trim() || currentUser.email?.split('@')[0] || 'Someone',
        messageType: 'text',
        text: message,
      }).catch(() => {});
    } catch {
      setReplyText(message);
      Alert.alert('Error', 'Failed to reply to this story.');
    }
  };

  const handleToggleStoryLike = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeStory) {
      return;
    }

    const existingLikes = activeStory.likes || [];
    const hasLiked = existingLikes.some((like) => like.userId === currentUser.uid);
    const optimisticLikes = hasLiked
      ? existingLikes.filter((like) => like.userId !== currentUser.uid)
      : [
          ...existingLikes,
          {
            userId: currentUser.uid,
            username: currentUser.displayName?.trim() || currentUser.email?.split('@')[0] || 'You',
            avatar: currentUser.photoURL || '',
            likedAt: Date.now(),
          },
        ];

    setViewerFeed((currentFeed) =>
      currentFeed
        ? {
            ...currentFeed,
            stories: currentFeed.stories.map((story) =>
              story.id === activeStory.id ? { ...story, likes: optimisticLikes } : story
            ),
          }
        : currentFeed
    );

    try {
      await toggleStoryLike(currentUser, activeStory.id);
    } catch {
      setViewerFeed((currentFeed) =>
        currentFeed
          ? {
              ...currentFeed,
              stories: currentFeed.stories.map((story) =>
                story.id === activeStory.id ? { ...story, likes: existingLikes } : story
              ),
            }
          : currentFeed
      );
      Alert.alert('Error', 'Failed to update story like.');
    }
  };

  const handleToggleStoryPrivacy = async (friendId: string) => {
    if (!currentUserId) {
      return;
    }

    const currentHiddenIds = new Set(currentUserProfile?.storyHiddenFriendIds || []);
    if (currentHiddenIds.has(friendId)) {
      currentHiddenIds.delete(friendId);
    } else {
      currentHiddenIds.add(friendId);
    }

    const nextHiddenIds = Array.from(currentHiddenIds);

    try {
      setIsSavingStoryPrivacy(friendId);
      await updateStoryPrivacy(currentUserId, nextHiddenIds);
      setCurrentUserProfile((currentProfile) =>
        currentProfile
          ? {
              ...currentProfile,
              storyHiddenFriendIds: nextHiddenIds,
            }
          : currentProfile
      );
    } catch {
      Alert.alert('Error', 'Failed to update story privacy.');
    } finally {
      setIsSavingStoryPrivacy(null);
    }
  };

  const renderStoryCard = ({ item }: { item: StoryFeedEntry }) => {
    const latestStory = item.stories[item.stories.length - 1];

    return (
      <TouchableOpacity
        onPress={() => openFeed(item)}
        className="mr-4 w-32"
        activeOpacity={0.85}
      >
        <View className="h-48 overflow-hidden rounded-3xl border border-border bg-card">
          {latestStory?.type === 'text' ? (
            <View className="flex-1 items-center justify-center bg-primary/10 px-4">
              <Text className="text-center text-base font-semibold text-foreground">
                {latestStory.text}
              </Text>
            </View>
          ) : latestStory?.type === 'image' && latestStory.mediaUrl ? (
            <Image
              source={{ uri: latestStory.mediaUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : latestStory?.type === 'video' && latestStory.mediaUrl ? (
            <View className="flex-1 bg-black/5">
              <StoryVideo uri={latestStory.mediaUrl} />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center bg-muted">
              <Text className="text-sm text-muted-foreground">Story</Text>
            </View>
          )}

          <View className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-3">
            <Text className="font-semibold text-white" numberOfLines={1}>
              {item.isOwn ? 'Your story' : item.username}
            </Text>
            <Text className="text-xs text-white/80">
              {item.stories.length} {item.stories.length === 1 ? 'update' : 'updates'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStoryPreview = (story: StoryItem | null) => {
    if (!story) return null;

    if (story.type === 'text') {
      return (
        <View className="flex-1 items-center justify-center bg-primary/10 px-10">
          <Text className="text-center text-3xl font-bold text-foreground">{story.text}</Text>
        </View>
      );
    }

    if (story.type === 'image' && story.mediaUrl) {
      return (
        <Image
          source={{ uri: story.mediaUrl }}
          className="h-full w-full"
          resizeMode="contain"
        />
      );
    }

    if (story.type === 'video' && story.mediaUrl) {
      return <StoryVideo uri={story.mediaUrl} />;
    }

    return null;
  };

  const formatStoryTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = Math.max(0, now - timestamp);
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffHours >= 1) {
      return `${diffHours}h ago`;
    }

    if (diffMinutes >= 1) {
      return `${diffMinutes}m ago`;
    }

    return 'Just now';
  };

  const seenViewers = activeStory?.views || [];
  const storyLikes = activeStory?.likes || [];
  const currentUserLikedStory = storyLikes.some((like) => like.userId === currentUserId);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="border-b border-border px-6 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-foreground">Stories</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Share quick updates with your friends
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setIsCreating(true)}
            className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2"
          >
            <Plus size={18} color="#FFFFFF" />
            <Text className="font-semibold text-primary-foreground">Add Story</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 128 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8">
            <Text className="mb-4 text-lg font-bold text-foreground">Your status</Text>

            {ownFeed ? (
              <FlatList
                data={[ownFeed]}
                horizontal
                keyExtractor={(item) => item.ownerId}
                renderItem={renderStoryCard}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setIsCreating(true)}
                className="rounded-3xl border border-dashed border-border bg-card px-6 py-8"
              >
                <Text className="text-lg font-semibold text-foreground">Post your story</Text>
                <Text className="mt-2 text-sm text-muted-foreground">
                  Share text, a photo, or a video. Stories stay visible for 24 hours.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View>
            <Text className="mb-4 text-lg font-bold text-foreground">Friends&apos; stories</Text>

            {friendFeeds.length > 0 ? (
              <FlatList
                data={friendFeeds}
                horizontal
                keyExtractor={(item) => item.ownerId}
                renderItem={renderStoryCard}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <View className="self-start rounded-full border border-border bg-card px-4 py-3">
                <Text className="font-semibold text-foreground">No stories</Text>
              </View>
            )}
          </View>

          <View className="mb-8 mt-10 rounded-3xl border border-border bg-card px-5 py-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Story Privacy</Text>
              <TouchableOpacity
                onPress={() => setShowPrivacyEditor((value) => !value)}
                className="rounded-full bg-secondary px-4 py-2"
              >
                <Text className="font-semibold text-secondary-foreground">
                  {showPrivacyEditor ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {showPrivacyEditor ? (
              friends.length > 0 ? (
                <View className="mt-4 gap-3">
                  {friends.map((friend) => {
                    const isHidden = Boolean(currentUserProfile?.storyHiddenFriendIds?.includes(friend.id));
                    const isSaving = isSavingStoryPrivacy === friend.id;

                    return (
                      <View
                        key={friend.id}
                        className="flex-row items-center justify-between rounded-2xl border border-border px-3 py-3"
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                            {friend.avatar ? (
                              <Image source={{ uri: friend.avatar }} className="h-full w-full" />
                            ) : (
                              <Text className="text-sm font-bold text-primary">
                                {friend.username.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <Text className="flex-1 font-medium text-foreground">{friend.username}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleToggleStoryPrivacy(friend.id)}
                          disabled={isSaving}
                          className={`rounded-full px-3 py-2 ${
                            isHidden ? 'bg-muted' : 'bg-primary'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isHidden ? 'text-foreground' : 'text-primary-foreground'
                            }`}
                          >
                            {isSaving ? 'Saving...' : isHidden ? 'Hidden' : 'Visible'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : null
            ) : null}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={isCreating}
        transparent
        animationType="slide"
        onRequestClose={closeComposer}
      >
        <Pressable className="flex-1 bg-black/40" onPress={closeComposer}>
          <Pressable className="mt-auto rounded-t-[32px] bg-background px-6 pb-10 pt-6">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Create Story</Text>
              <TouchableOpacity onPress={closeComposer} className="rounded-full bg-secondary p-2">
                <X size={18} color="#111827" />
              </TouchableOpacity>
            </View>

            <View
              className="mb-5 rounded-3xl border border-border bg-card p-4"
              style={{
                marginBottom: keyboardHeight > 0 ? Math.max(keyboardHeight - insets.bottom - 24, 0) : 0,
              }}
            >
              <Text className="mb-3 font-semibold text-foreground">Text story</Text>
              <TextInput
                value={textDraft}
                onChangeText={setTextDraft}
                placeholder="Say something for your friends..."
                placeholderTextColor="#9CA3AF"
                multiline
                className="min-h-[120px] rounded-2xl bg-input px-4 py-4 text-base text-foreground"
                maxLength={200}
              />
              <TouchableOpacity
                onPress={handleCreateTextStory}
                disabled={isUploading || !textDraft.trim()}
                className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
                  isUploading || !textDraft.trim() ? 'bg-muted' : 'bg-primary'
                }`}
              >
                <Type size={18} color={isUploading || !textDraft.trim() ? '#9CA3AF' : '#FFFFFF'} />
                <Text
                  className={`font-semibold ${
                    isUploading || !textDraft.trim() ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}
                >
                  Post text story
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => handleCreateMediaStory('image')}
                disabled={isUploading}
                className={`flex-1 rounded-2xl px-4 py-4 ${
                  isUploading ? 'bg-muted' : 'bg-card'
                } border border-border`}
              >
                <ImageIcon size={22} color={isUploading ? '#9CA3AF' : '#8B5CF6'} />
                <Text className="mt-3 font-semibold text-foreground">Photo story</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Upload a photo for friends</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleCreateMediaStory('video')}
                disabled={isUploading}
                className={`flex-1 rounded-2xl px-4 py-4 ${
                  isUploading ? 'bg-muted' : 'bg-card'
                } border border-border`}
              >
                <VideoIcon size={22} color={isUploading ? '#9CA3AF' : '#8B5CF6'} />
                <Text className="mt-3 font-semibold text-foreground">Video story</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Upload a video for friends</Text>
              </TouchableOpacity>
            </View>

            {isUploading ? (
              <Text className="mt-4 text-center text-sm text-muted-foreground">
                Uploading your story...
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(viewerFeed)}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setViewerFeed(null)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row gap-2 px-4 pb-3 pt-3">
            {viewerFeed?.stories.map((story) => (
              <View
                key={story.id}
                className={`h-1 flex-1 rounded-full ${
                  story.id === activeStory?.id ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </View>

          <View className="flex-row items-center justify-between px-4 pb-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/20">
                {viewerFeed?.avatar ? (
                  <Image source={{ uri: viewerFeed.avatar }} className="h-full w-full" />
                ) : (
                  <Text className="text-lg font-bold text-white">
                    {viewerFeed?.username?.[0]?.toUpperCase() || '?'}
                  </Text>
                )}
              </View>

              <View>
                <Text className="text-xl font-bold text-white">
                  {viewerFeed?.isOwn ? 'Your story' : viewerFeed?.username}
                </Text>
                <Text className="text-sm text-white/80">
                  {activeStory ? formatStoryTime(activeStory.createdAt) : ''}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              {viewerFeed?.isOwn && activeStory ? (
                <TouchableOpacity
                  onPress={handleDeleteActiveStory}
                  className="rounded-full bg-white/15 p-2.5"
                >
                  <Trash2 size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={() => setViewerFeed(null)} className="rounded-full bg-white/15 p-2.5">
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-1">
            {renderStoryPreview(activeStory)}

            <View className="absolute inset-0 flex-row">
              <Pressable className="flex-1" onPress={showPreviousStory} />
              <Pressable className="flex-1" onPress={showNextStory} />
            </View>
          </View>

          {viewerFeed?.isOwn && activeStory ? (
            <View
              className="border-t border-white/10 bg-black/55 px-4 py-4"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <TouchableOpacity
                onLongPress={() => setShowStoryLikes(true)}
                activeOpacity={0.85}
                className="mb-3 flex-row items-center gap-2"
              >
                <Heart size={16} color="#FFFFFF" />
                <Text className="font-semibold text-white">
                  {storyLikes.length} {storyLikes.length === 1 ? 'like' : 'likes'}
                </Text>
              </TouchableOpacity>

              <View className="mb-3 flex-row items-center gap-2">
                <Eye size={16} color="#FFFFFF" />
                <Text className="font-semibold text-white">
                  Seen by {seenViewers.length}
                </Text>
              </View>

              {seenViewers.length > 0 ? (
                <ScrollView
                  style={styles.seenList}
                  contentContainerStyle={styles.seenListContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View className="gap-3">
                    {seenViewers.map((viewer) => (
                      <View
                        key={viewer.userId}
                        className="flex-row items-center gap-3 rounded-2xl bg-white/10 px-3 py-3"
                      >
                        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/20">
                          {viewer.avatar ? (
                            <Image source={{ uri: viewer.avatar }} className="h-full w-full" />
                          ) : (
                            <Text className="text-sm font-bold text-white">
                              {viewer.username[0]?.toUpperCase() || '?'}
                            </Text>
                          )}
                        </View>
                        <View>
                          <Text className="font-medium text-white">{viewer.username}</Text>
                          <Text className="text-xs text-white/70">
                            {formatStoryTime(viewer.seenAt)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text className="text-sm text-white/70">
                  No one has viewed this story yet.
                </Text>
              )}
            </View>
          ) : viewerFeed && !viewerFeed.isOwn ? (
            <View
              className="border-t border-white/10 bg-black/55 px-4 py-4"
              style={{ marginBottom: keyboardHeight, paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <View className="mb-3 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={handleToggleStoryLike}
                  className="flex-row items-center gap-2 rounded-full bg-white/10 px-4 py-2"
                >
                  <Heart
                    size={18}
                    color={currentUserLikedStory ? '#F43F5E' : '#FFFFFF'}
                    fill={currentUserLikedStory ? '#F43F5E' : 'transparent'}
                  />
                  <Text className="font-semibold text-white">
                    {storyLikes.length} {storyLikes.length === 1 ? 'like' : 'likes'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="min-h-[48px] flex-1 justify-center rounded-2xl bg-white/10 px-4">
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder={`Reply to ${viewerFeed.username}'s story...`}
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    className="py-3 text-base text-white"
                    multiline
                    maxLength={300}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleReplyToStory}
                  disabled={!replyText.trim()}
                  className={`rounded-full px-5 py-3 ${replyText.trim() ? 'bg-white' : 'bg-white/20'}`}
                >
                  <Text className={`font-semibold ${replyText.trim() ? 'text-black' : 'text-white/60'}`}>
                    Send
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showStoryLikes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStoryLikes(false)}
      >
        <Pressable className="flex-1 bg-black/50" onPress={() => setShowStoryLikes(false)}>
          <Pressable className="mt-auto rounded-t-[28px] bg-background px-6 pb-8 pt-5">
            <Text className="mb-4 text-center text-xl font-bold text-foreground">Story likes</Text>
            {storyLikes.length === 0 ? (
              <Text className="text-center text-muted-foreground">No likes yet</Text>
            ) : (
              <FlatList
                data={storyLikes}
                keyExtractor={(item) => item.userId}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View className="mb-3 flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/20">
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} className="h-full w-full" />
                      ) : (
                        <Text className="text-sm font-bold text-primary">
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text className="text-base font-medium text-foreground">{item.username}</Text>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seenList: {
    maxHeight: 208,
  },
  seenListContent: {
    paddingBottom: 4,
  },
});
