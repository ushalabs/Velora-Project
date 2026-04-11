import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Pressable,
  Modal,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Send,
  Smile,
  Sticker,
  Users,
  Video as VideoIcon,
} from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { auth } from '@/lib/firebase';
import {
  deleteMessageForEveryone,
  deleteMessageForSelf,
  getConversationId,
  getConversationInfo,
  hideConversationForUser,
  leaveGroupConversation,
  sendConversationMediaMessage,
  sendConversationMessage,
  sendConversationStickerMessage,
  subscribeToConversationInfo,
  subscribeToConversationMembers,
  subscribeToMessages,
  subscribeToUserProfile,
  type ChatMessage,
  type ConversationInfo,
  type FoundUser,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { sendMessagePushNotification } from '@/lib/push-api';

const QUICK_EMOJIS = ['\u{1F600}', '\u{1F602}', '\u{1F60D}', '\u{1F979}', '\u{1F62D}', '\u{1F60E}', '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F44D}', '\u{1F389}', '\u{1F91D}', '\u{2728}'];
const STICKER_EMOJIS = ['\u{1F388}', '\u{1F389}', '\u{1F496}', '\u{1F525}', '\u{1F602}', '\u{1F60E}', '\u{1F973}', '\u{1F90D}'];

const getSenderName = (user: typeof auth.currentUser) =>
  user?.displayName?.trim() || user?.email?.split('@')[0] || 'Someone';

function formatDuration(durationMs?: number) {
  const totalSeconds = Math.max(0, Math.round((durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AudioMessagePlayer({
  uri,
  durationMs,
  onLongPress,
}: {
  uri: string;
  durationMs?: number;
  onLongPress?: () => void;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <TouchableOpacity
      onPress={() => {
        if (status.playing) {
          player.pause();
        } else {
          player.play();
        }
      }}
      onLongPress={onLongPress}
      className="w-56 flex-row items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
        {status.playing ? (
          <Pause size={18} color="#FFFFFF" />
        ) : (
          <Play size={18} color="#FFFFFF" />
        )}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-foreground">Voice message</Text>
        <Text className="text-sm text-muted-foreground">
          {formatDuration(durationMs)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      allowsFullscreen
      nativeControls
    />
  );
}

function InlineVideoPreview({ uri }: { uri: string }) {
  return (
    <View className="relative h-56 w-56 items-center justify-center overflow-hidden rounded-2xl bg-black/10">
      <Image
        source={{ uri }}
        className="h-full w-full"
        resizeMode="cover"
      />
      <View className="absolute h-16 w-16 items-center justify-center rounded-full bg-black/55">
        <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const didInitialScrollRef = useRef(false);
  const sentByMeRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPositionedAtBottom, setIsPositionedAtBottom] = useState(false);
  const [composerHeight, setComposerHeight] = useState(92);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputText, setInputText] = useState("");
  const [friend, setFriend] = useState<FoundUser | null>(null);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<FoundUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasConversation, setHasConversation] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [showAttachmentBar, setShowAttachmentBar] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const currentUser = auth.currentUser;
  const routeId = id || '';
  const conversationId =
    currentUser && routeId
      ? conversationInfo
        ? conversationInfo.id
        : getConversationId(currentUser.uid, routeId)
      : '';
  const isGroupConversation = conversationInfo?.type === 'group';

  const closeComposerPanels = () => {
    setShowAttachmentBar(false);
    setShowEmojiPicker(false);
    setShowStickerPicker(false);
  };

  const scrollToBottom = (animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasConversation(false);
      setIsPositionedAtBottom(true);
      return;
    }

    didInitialScrollRef.current = false;
    setIsPositionedAtBottom(false);
  }, [conversationId]);

  useEffect(() => {
    if (!currentUser || !routeId) return;

    let unsubscribeMessages = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribeConversation = () => {};
    let unsubscribeMembers = () => {};
    let isMounted = true;

    const connect = async () => {
      const routeConversation = await getConversationInfo(routeId);

      if (!isMounted) return;

      if (routeConversation) {
        setConversationInfo(routeConversation);
        setHasConversation(true);
        setIsLoading(false);

        if (routeConversation.type === 'group') {
          setFriend({
            id: routeConversation.id,
            username: routeConversation.title,
            avatar: routeConversation.avatar,
          });

          unsubscribeConversation = subscribeToConversationInfo(routeId, (nextConversation) => {
            setConversationInfo(nextConversation);
            if (nextConversation) {
              setFriend({
                id: nextConversation.id,
                username: nextConversation.title,
                avatar: nextConversation.avatar,
              });
            }
          });

          unsubscribeMembers = subscribeToConversationMembers(routeId, setGroupMembers);
        } else {
          const otherUserId = routeConversation.memberIds.find(
            (memberId) => memberId !== currentUser.uid
          );

          if (otherUserId) {
            unsubscribeProfile = subscribeToUserProfile(otherUserId, (nextFriend) => {
              setFriend(nextFriend);
            });
          }
        }

        unsubscribeMessages = subscribeToMessages(routeId, currentUser.uid, setMessages);
        return;
      }

      setConversationInfo(null);
      const directConversationId = getConversationId(currentUser.uid, routeId);
      setHasConversation(await getConversationInfo(directConversationId).then(Boolean));
      unsubscribeProfile = subscribeToUserProfile(routeId, (nextFriend) => {
        setFriend(nextFriend);
        setIsLoading(false);
      });
      unsubscribeMessages = subscribeToMessages(
        directConversationId,
        currentUser.uid,
        setMessages
      );
    };

    void connect();

    return () => {
      isMounted = false;
      unsubscribeMessages();
      unsubscribeProfile();
      unsubscribeConversation();
      unsubscribeMembers();
    };
  }, [currentUser, routeId]);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      const bottomInset = Platform.OS === 'ios' ? insets.bottom : 0;
      setKeyboardHeight(Math.max(0, event.endCoordinates.height - bottomInset));
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
  }, [insets.bottom]);

  const handleSend = async () => {
    if (!currentUser || !conversationId || !hasConversation) {
      Alert.alert('Error', 'Unable to send message right now.');
      return;
    }

    try {
      if (recorderState.isRecording) {
        await recorder.stop();

        if (!recorder.uri) {
          Alert.alert('Error', 'Recording file was not created.');
          return;
        }

        setIsUploadingMedia(true);
        const upload = await uploadToCloudinary({
          uri: recorder.uri,
          fileName: 'voice-message.m4a',
          mimeType: 'audio/m4a',
          folder: 'velora/chat-audio',
        });

        sentByMeRef.current = true;
        await sendConversationMediaMessage(currentUser, conversationId, {
          type: 'audio',
          mediaUrl: upload.url,
          durationMs: recorderState.durationMillis,
        });
        void sendMessagePushNotification({
          conversationId,
          senderName: getSenderName(currentUser),
          messageType: 'audio',
        }).catch(() => {});
        closeComposerPanels();
        return;
      }

      const trimmedText = inputText.trim();
      if (!trimmedText) return;

      sentByMeRef.current = true;
      await sendConversationMessage(currentUser, conversationId, trimmedText);
      void sendMessagePushNotification({
        conversationId,
        senderName: getSenderName(currentUser),
        messageType: 'text',
        text: trimmedText,
      }).catch(() => {});
      setInputText("");
      closeComposerPanels();
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleStartRecording = async () => {
    if (!currentUser || !conversationId || !hasConversation) {
      Alert.alert('Unavailable', 'You can send voice messages after the friend request is accepted.');
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access to record voice messages.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      closeComposerPanels();
    } catch {
      Alert.alert('Error', 'Voice message recording failed. Please try again.');
    }
  };

  const appendEmoji = (emoji: string) => {
    setInputText((currentText) => `${currentText}${emoji}`);
  };

  const handleSendSticker = async (sticker: string) => {
    if (!currentUser || !conversationId || !hasConversation) {
      Alert.alert('Unavailable', 'You can send stickers after the friend request is accepted.');
      return;
    }

    try {
      sentByMeRef.current = true;
      await sendConversationStickerMessage(currentUser, conversationId, sticker);
      void sendMessagePushNotification({
        conversationId,
        senderName: getSenderName(currentUser),
        messageType: 'sticker',
        text: sticker,
      }).catch(() => {});
      closeComposerPanels();
    } catch {
      Alert.alert('Error', 'Failed to send sticker.');
    }
  };

  const handleOpenMedia = (message: ChatMessage) => {
    if (message.mediaUrl && (message.type === 'image' || message.type === 'video')) {
      setViewerMessage(message);
    }
  };

  const handleSaveMedia = async () => {
    if (!viewerMessage?.mediaUrl) return;

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        'photo',
        'video',
      ]);

      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow gallery access to save media.');
        return;
      }

      const extension = viewerMessage.type === 'video' ? 'mp4' : 'jpg';
      const localPath = `${FileSystem.cacheDirectory}velora-${Date.now()}.${extension}`;
      const downloaded = await FileSystem.downloadAsync(
        viewerMessage.mediaUrl,
        localPath
      );

      await MediaLibrary.createAssetAsync(downloaded.uri);
      Alert.alert('Saved', 'Media was saved to your gallery.');
    } catch {
      Alert.alert('Error', 'Failed to save media.');
    }
  };

  const handleDeleteMessage = (message: ChatMessage) => {
    if (!currentUser || !conversationId || message.senderId !== currentUser.uid) {
      return;
    }

    Alert.alert('Delete message', 'Choose how you want to delete this message.', [
      {
        text: 'Delete for me',
        onPress: async () => {
          try {
            await deleteMessageForSelf(conversationId, message.id, currentUser.uid);
          } catch {
            Alert.alert('Error', 'Failed to delete message for you.');
          }
        },
      },
      {
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessageForEveryone(
              conversationId,
              message.id,
              currentUser.uid
            );
          } catch {
            Alert.alert('Error', 'Failed to delete message for everyone.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleConversationOptions = () => {
    if (!currentUser || !conversationId) return;

    if (isGroupConversation) {
      Alert.alert(
        friend?.username || 'Group',
        'Choose an action for this group.',
        [
          {
            text: 'Delete for me',
            onPress: async () => {
              try {
                await hideConversationForUser(conversationId, currentUser.uid);
                router.back();
              } catch {
                Alert.alert('Error', 'Failed to delete this group for you.');
              }
            },
          },
          {
            text: 'Leave group',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveGroupConversation(conversationId, currentUser.uid);
                router.replace('/(tabs)/friends');
              } catch {
                Alert.alert('Error', 'Failed to leave this group.');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    Alert.alert(
      friend?.username || 'Chat',
      'Delete this chat for you only?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: async () => {
            try {
              await hideConversationForUser(conversationId, currentUser.uid);
              router.replace('/(tabs)/friends');
            } catch {
              Alert.alert('Error', 'Failed to delete this chat for you.');
            }
          },
        },
      ]
    );
  };

  const handlePickMedia = async (kind: 'image' | 'video') => {
    if (!currentUser || !conversationId || !hasConversation) {
      Alert.alert('Unavailable', 'You can send media after the friend request is accepted.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow media library access to send media.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          kind === 'image'
            ? ImagePicker.MediaTypeOptions.Images
            : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: kind === 'image',
        quality: 0.8,
      });

      if (result.canceled) return;

      closeComposerPanels();
      setIsUploadingMedia(true);

      const selectedAsset = result.assets[0];
      const upload = await uploadToCloudinary({
        uri: selectedAsset.uri,
        fileName: selectedAsset.fileName,
        mimeType: selectedAsset.mimeType,
        folder: kind === 'image' ? 'velora/chat-images' : 'velora/chat-videos',
      });

      sentByMeRef.current = true;
      await sendConversationMediaMessage(currentUser, conversationId, {
        type: kind,
        mediaUrl: upload.url,
      });
      void sendMessagePushNotification({
        conversationId,
        senderName: getSenderName(currentUser),
        messageType: kind,
      }).catch(() => {});
    } catch {
      Alert.alert('Error', `Failed to send ${kind}. Please try again.`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.senderId === currentUser?.uid;
    const isMediaMessage =
      !item.deletedForAll &&
      (item.type === 'image' || item.type === 'video' || item.type === 'audio');

    return (
      <View className={`mb-3 flex-row ${isUser ? "justify-end" : "justify-start"}`}>
        <Pressable
          disabled={!isUser}
          onLongPress={() => handleDeleteMessage(item)}
          className={
            isMediaMessage
              ? 'max-w-[75%]'
              : `max-w-[75%] rounded-2xl px-4 py-3 ${
                  isUser ? 'rounded-tr-sm bg-primary' : 'rounded-tl-sm bg-secondary'
                }`
          }
        >
          {item.deletedForAll ? (
            <Text
              className={`italic ${
                isUser ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              Message deleted
            </Text>
          ) : null}

          {!item.deletedForAll && item.type === 'image' && item.mediaUrl ? (
            <Pressable
              onPress={() => handleOpenMedia(item)}
              onLongPress={isUser ? () => handleDeleteMessage(item) : undefined}
            >
              <Image
                source={{ uri: item.mediaUrl }}
                className="h-56 w-56 rounded-2xl"
                resizeMode="cover"
              />
            </Pressable>
          ) : null}

          {!item.deletedForAll && item.type === 'video' && item.mediaUrl ? (
            <Pressable
              onPress={() => handleOpenMedia(item)}
              onLongPress={isUser ? () => handleDeleteMessage(item) : undefined}
            >
              <InlineVideoPreview uri={item.mediaUrl} />
            </Pressable>
          ) : null}

          {!item.deletedForAll && item.type === 'audio' && item.mediaUrl ? (
            <AudioMessagePlayer
              uri={item.mediaUrl}
              durationMs={item.durationMs}
              onLongPress={isUser ? () => handleDeleteMessage(item) : undefined}
            />
          ) : null}

          {!item.deletedForAll && item.type === 'sticker' && item.text ? (
            <Text className="text-6xl">{item.text}</Text>
          ) : null}

          {!item.deletedForAll && item.text ? (
            <View className={item.mediaUrl || item.type === 'sticker' ? 'mt-3' : ''}>
              {!isUser && isGroupConversation && item.senderUsername ? (
                <Text className="mb-1 text-xs font-semibold text-primary">
                  {item.senderUsername}
                </Text>
              ) : null}
              <Text
                className={`text-base ${
                  isUser ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {item.text}
              </Text>
            </View>
          ) : null}

          <Text
            className={`mt-1 text-xs ${
              isMediaMessage
                ? 'text-muted-foreground'
                : isUser
                  ? 'text-primary-foreground/70'
                  : 'text-muted-foreground'
            }`}
          >
            {new Date(item.createdAt || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Pressable>
      </View>
    );
  };

  const EmptyState = () => (
    <View className="items-center justify-center px-8 py-20">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-secondary">
        <Send
          className="text-secondary-foreground"
          size={32}
          strokeWidth={1.5}
        />
      </View>
      <Text className="mb-2 text-xl font-semibold text-foreground">
        {hasConversation ? 'No messages yet' : 'Waiting for acceptance'}
      </Text>
      <Text className="text-center text-muted-foreground">
        {hasConversation
          ? `Say hello to ${friend?.username || 'your friend'} and start the conversation!`
          : `${friend?.username || 'This user'} needs to accept the friend request before you can chat.`}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </SafeAreaView>
    );
  }

  const showSendButton = recorderState.isRecording || inputText.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="-ml-2 p-2">
          <ArrowLeft className="text-foreground" size={24} />
        </TouchableOpacity>

        <View className="ml-2 flex-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/20">
            {friend?.avatar ? (
              <Image source={{ uri: friend.avatar }} className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-primary/30">
                <Text className="text-lg font-bold text-primary">
                  {friend?.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text className="text-base font-semibold text-foreground">
              {friend?.username || 'Friend'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {isGroupConversation ? `${groupMembers.length} members` : 'Realtime chat'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {isGroupConversation ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/group-manage/[id]',
                  params: { id: conversationId },
                })
              }
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
            >
              <Users className="text-foreground" size={18} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={handleConversationOptions}
            className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <MoreVertical className="text-foreground" size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: composerHeight + 12,
            flexGrow: messages.length === 0 ? 1 : 0,
            justifyContent: messages.length === 0 ? 'center' : 'flex-start',
          }}
          style={{ opacity: isPositionedAtBottom ? 1 : 0 }}
          ListEmptyComponent={<EmptyState />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onTouchStart={closeComposerPanels}
          onScrollBeginDrag={closeComposerPanels}
          onLayout={() => {
            if (!didInitialScrollRef.current && messages.length > 0) {
              didInitialScrollRef.current = true;
              scrollToBottom(false);
              setIsPositionedAtBottom(true);
              return;
            }

            if (messages.length === 0) {
              setIsPositionedAtBottom(true);
            }
          }}
          onContentSizeChange={() => {
            if (!didInitialScrollRef.current && messages.length > 0) {
              didInitialScrollRef.current = true;
              scrollToBottom(false);
              setIsPositionedAtBottom(true);
              return;
            }

            if (messages.length === 0) {
              setIsPositionedAtBottom(true);
              return;
            }

            if (sentByMeRef.current) {
              sentByMeRef.current = false;
              scrollToBottom(true);
            }
          }}
        />

        <View
          onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          className="absolute inset-x-0 bottom-0 border-t border-border bg-background"
          style={{
            bottom: keyboardHeight,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {showAttachmentBar ? (
            <View className="border-t border-border bg-card px-4 py-3">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => handlePickMedia('image')}
                  disabled={!hasConversation || isUploadingMedia}
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    hasConversation && !isUploadingMedia ? 'bg-secondary' : 'bg-muted'
                  }`}
                >
                  <ImageIcon size={18} color={hasConversation && !isUploadingMedia ? '#111827' : '#9CA3AF'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePickMedia('video')}
                  disabled={!hasConversation || isUploadingMedia}
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    hasConversation && !isUploadingMedia ? 'bg-secondary' : 'bg-muted'
                  }`}
                >
                  <VideoIcon size={18} color={hasConversation && !isUploadingMedia ? '#111827' : '#9CA3AF'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowEmojiPicker((value) => !value);
                    setShowStickerPicker(false);
                    setShowAttachmentBar(false);
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-secondary"
                >
                  <Smile size={18} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowStickerPicker((value) => !value);
                    setShowEmojiPicker(false);
                    setShowAttachmentBar(false);
                  }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-secondary"
                >
                  <Sticker size={18} color="#111827" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {showEmojiPicker ? (
            <View className="border-t border-border bg-card px-4 py-3">
              <View className="flex-row flex-wrap gap-3">
                {QUICK_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => appendEmoji(emoji)}
                    className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary"
                  >
                    <Text className="text-2xl">{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {showStickerPicker ? (
            <View className="border-t border-border bg-card px-4 py-3">
              <View className="flex-row flex-wrap gap-3">
                {STICKER_EMOJIS.map((stickerEmoji) => (
                  <TouchableOpacity
                    key={stickerEmoji}
                    onPress={() => handleSendSticker(stickerEmoji)}
                    className="h-20 w-20 items-center justify-center rounded-3xl bg-secondary"
                  >
                    <Text className="text-5xl">{stickerEmoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <View className="bg-background p-4">
            {recorderState.isRecording ? (
              <View className="mb-3 rounded-2xl bg-destructive/10 px-4 py-3">
                <Text className="font-semibold text-foreground">
                  Recording voice message... Tap send when done. {formatDuration(recorderState.durationMillis)}
                </Text>
              </View>
            ) : null}

            <View className="flex-row items-end gap-2">
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAttachmentBar((value) => !value);
                  setShowEmojiPicker(false);
                  setShowStickerPicker(false);
                }}
                className="mb-1 h-11 w-11 items-center justify-center rounded-full bg-secondary"
              >
                <Plus size={18} color="#111827" />
              </TouchableOpacity>

              <View className="min-h-[48px] flex-1 justify-center rounded-2xl border border-border bg-input px-4">
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={closeComposerPanels}
                  placeholder="Type a message..."
                  placeholderTextColor="#9CA3AF"
                  className="py-3 text-base text-foreground"
                  multiline
                  maxLength={500}
                />
              </View>

              {showSendButton ? (
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!hasConversation || isUploadingMedia}
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    hasConversation && !isUploadingMedia ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Send size={20} color={hasConversation && !isUploadingMedia ? '#FFFFFF' : '#9CA3AF'} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleStartRecording}
                  disabled={!hasConversation || isUploadingMedia}
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    hasConversation && !isUploadingMedia ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Mic size={20} color={hasConversation && !isUploadingMedia ? '#FFFFFF' : '#9CA3AF'} />
                </TouchableOpacity>
              )}
            </View>

            {isUploadingMedia ? (
              <Text className="mt-3 text-sm text-muted-foreground">
                Uploading media...
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <Modal
        visible={Boolean(viewerMessage)}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewerMessage(null)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity onPress={() => setViewerMessage(null)}>
              <Text className="text-base font-semibold text-white">Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveMedia}>
              <Text className="text-base font-semibold text-white">Save</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1 items-center justify-center px-4 pb-8">
            {viewerMessage?.type === 'image' && viewerMessage.mediaUrl ? (
              <Image
                source={{ uri: viewerMessage.mediaUrl }}
                className="h-full w-full"
                resizeMode="contain"
              />
            ) : null}

            {viewerMessage?.type === 'video' && viewerMessage.mediaUrl ? (
              <FullscreenVideo uri={viewerMessage.mediaUrl} />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
