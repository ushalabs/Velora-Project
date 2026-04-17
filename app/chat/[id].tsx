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
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  sendConversationMediaMessage,
  sendConversationMessage,
  sendConversationStickerMessage,
  markConversationSeen,
  subscribeToConversationInfo,
  subscribeToConversationMembers,
  subscribeToMessages,
  subscribeToUserProfile,
  toggleConversationMessageReaction,
  type ChatMessage,
  type ConversationInfo,
  type FoundUser,
  updateConversationMessage,
  updateConversationTyping,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { sendMessagePushNotification } from '@/lib/push-api';
import ThemedActionSheet, { type ThemedActionSheetOption } from '@/components/themed-action-sheet';

const QUICK_EMOJIS = ['\u{1F600}', '\u{1F602}', '\u{1F60D}', '\u{1F979}', '\u{1F62D}', '\u{1F60E}', '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F44D}', '\u{1F389}', '\u{1F91D}', '\u{2728}'];
const STICKER_EMOJIS = ['\u{1F388}', '\u{1F389}', '\u{1F496}', '\u{1F525}', '\u{1F602}', '\u{1F60E}', '\u{1F973}', '\u{1F90D}'];
const MESSAGE_REACTIONS = ['❤️', '😡', '😂', '😢', '👍'];

const getSenderName = (user: typeof auth.currentUser) =>
  user?.displayName?.trim() || user?.email?.split('@')[0] || 'Someone';

const formatMessageTime = (timestamp?: number) =>
  new Date(timestamp || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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

const isEmojiOnlyText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    return /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\s]+$/u.test(trimmed);
  } catch {
    return false;
  }
};

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
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.pause();
  });

  return (
    <View className="relative h-56 w-56 items-center justify-center overflow-hidden rounded-2xl bg-black/10">
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls={false}
        contentFit="cover"
      />
      <View className="absolute h-16 w-16 items-center justify-center rounded-full bg-black/55">
        <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
      </View>
    </View>
  );
}

function StoryReplyPreview({
  replyTo,
  isUser,
}: {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  isUser: boolean;
}) {
  const storyLabel =
    replyTo.ownerUsername === auth.currentUser?.displayName
      ? 'your story'
      : `${replyTo.ownerUsername}'s story`;

  return (
    <View
      className={`mb-2 overflow-hidden rounded-2xl border px-3 py-2 ${
        isUser
          ? 'border-primary-foreground/20 bg-primary-foreground/10'
          : 'border-border bg-black/5'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          isUser ? 'text-primary-foreground/80' : 'text-primary'
        }`}
      >
        Replied to {storyLabel}
      </Text>

      {replyTo.storyType === 'text' && replyTo.storyText ? (
        <Text
          numberOfLines={2}
          className={`mt-1 text-sm ${
            isUser ? 'text-primary-foreground/90' : 'text-foreground'
          }`}
        >
          {replyTo.storyText}
        </Text>
      ) : null}

      {(replyTo.storyType === 'image' || replyTo.storyType === 'video') && replyTo.storyMediaUrl ? (
        <View className="mt-2 overflow-hidden rounded-xl">
          <Image
            source={{ uri: replyTo.storyMediaUrl }}
            className="h-20 w-20 rounded-xl"
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const didInitialScrollRef = useRef(false);
  const sentByMeRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastTapRef = useRef<{ messageId: string; at: number } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerHeight, setComposerHeight] = useState(92);
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingStateRef = useRef(false);
  const lastSeenMessageRef = useRef<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [statusClock, setStatusClock] = useState(Date.now());
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    title: string;
    message?: string;
    reactions?: ThemedActionSheetOption[];
    options: ThemedActionSheetOption[];
  } | null>(null);

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

  const setTypingState = (isTyping: boolean) => {
    if (!currentUser || !conversationId || !hasConversation) {
      return;
    }

    if (lastTypingStateRef.current === isTyping) {
      return;
    }

    lastTypingStateRef.current = isTyping;
    void updateConversationTyping(conversationId, currentUser.uid, isTyping).catch(() => {});
  };

  const scheduleTypingReset = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingState(false);
    }, 1800);
  };

  const scrollToBottom = (animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  };

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasConversation(false);
      isNearBottomRef.current = true;
      return;
    }

    didInitialScrollRef.current = false;
    isNearBottomRef.current = true;
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
      unsubscribeConversation = subscribeToConversationInfo(directConversationId, (nextConversation) => {
        setConversationInfo(nextConversation);
        setHasConversation(Boolean(nextConversation));
      });
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
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (currentUser && conversationId && hasConversation) {
        void updateConversationTyping(conversationId, currentUser.uid, false).catch(() => {});
      }
    };
  }, [conversationId, currentUser, hasConversation]);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
      if (isNearBottomRef.current) {
        scrollToBottom(false);
      }
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
    const interval = setInterval(() => {
      setStatusClock(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentUser || !conversationId || !hasConversation || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.id === lastSeenMessageRef.current) {
      return;
    }

    lastSeenMessageRef.current = latestMessage.id;
    void markConversationSeen(conversationId, currentUser.uid).catch(() => {});
  }, [messages, currentUser, conversationId, hasConversation]);

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
        setTypingState(false);
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

      if (editingMessage) {
        await updateConversationMessage(
          conversationId,
          editingMessage.id,
          currentUser.uid,
          trimmedText
        );
        setInputText('');
        setEditingMessage(null);
        closeComposerPanels();
        return;
      }

      sentByMeRef.current = true;
      setInputText("");
      setTypingState(false);
      await sendConversationMessage(currentUser, conversationId, trimmedText);
      void sendMessagePushNotification({
        conversationId,
        senderName: getSenderName(currentUser),
        messageType: 'text',
        text: trimmedText,
      }).catch(() => {});
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

  const handleMessageTap = (message: ChatMessage) => {
    if (!currentUser || !conversationId || message.deletedForAll || message.type === 'system') {
      return;
    }

    const now = Date.now();
    if (
      lastTapRef.current &&
      lastTapRef.current.messageId === message.id &&
      now - lastTapRef.current.at < 300
    ) {
      lastTapRef.current = null;
      void toggleConversationMessageReaction(currentUser, conversationId, message, '❤️').catch(() => {
        Alert.alert('Error', 'Failed to react to this message.');
      });
      return;
    }

    lastTapRef.current = {
      messageId: message.id,
      at: now,
    };
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
    if (!currentUser || !conversationId) {
      return;
    }

    const reactionOptions: ThemedActionSheetOption[] =
      !message.deletedForAll && message.type !== 'system'
        ? MESSAGE_REACTIONS.map((emoji) => ({
            label: emoji,
            onPress: async () => {
              try {
                await toggleConversationMessageReaction(currentUser, conversationId, message, emoji);
              } catch {
                Alert.alert('Error', 'Failed to react to this message.');
              }
            },
          }))
        : [];
    const options: ThemedActionSheetOption[] = [];

    if (message.senderId === currentUser.uid) {
      if (message.type === 'text' && !message.deletedForAll) {
        options.push({
          label: 'Edit',
          onPress: () => {
            setEditingMessage(message);
            setInputText(message.text);
            closeComposerPanels();
            requestAnimationFrame(() => {
              inputRef.current?.focus();
            });
          },
        });
      }
      options.push({
        label: 'Delete for me only',
        onPress: async () => {
          try {
            await deleteMessageForSelf(conversationId, message.id, currentUser.uid);
          } catch {
            Alert.alert('Error', 'Failed to delete message for you.');
          }
        },
      });
      options.push({
        label: 'Delete',
        destructive: true,
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
      });
    } else {
      options.push({
        label: 'Delete for me only',
        onPress: async () => {
          try {
            await deleteMessageForSelf(conversationId, message.id, currentUser.uid);
          } catch {
            Alert.alert('Error', 'Failed to delete message for you.');
          }
        },
      });
    }

    setActionSheetConfig({
      title: 'Message options',
      message: `Sent at ${formatMessageTime(message.createdAt)}`,
      reactions: reactionOptions,
      options,
    });
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
            ? ['images']
            : ['videos'],
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
    const senderProfile = isGroupConversation
      ? groupMembers.find((member) => member.id === item.senderId) || null
      : friend;
    const groupedReactions = Array.from(
      (item.reactions || []).reduce((map, reaction) => {
        const existing = map.get(reaction.emoji) || 0;
        map.set(reaction.emoji, existing + 1);
        return map;
      }, new Map<string, number>())
    );
    const isLastOwnMessage =
      isUser && !item.deletedForAll && Boolean(lastOwnMessageId) && item.id === lastOwnMessageId;
    const isMediaMessage =
      !item.deletedForAll &&
      (item.type === 'image' || item.type === 'video' || item.type === 'audio');
    const isEmojiOnly = !item.deletedForAll && item.type === 'text' && isEmojiOnlyText(item.text);

    if (item.type === 'system') {
      return (
        <View className="mb-3 items-center">
          <Text className="rounded-full bg-secondary px-4 py-2 text-center text-xs font-medium text-muted-foreground">
            {item.text}
          </Text>
        </View>
      );
    }

    return (
      <View className="mb-2">
        <View className={`flex-row items-end ${isUser ? "justify-end" : "justify-start"}`}>
          {!isUser ? (
            <View className="mr-2 h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/20">
              {senderProfile?.avatar ? (
                <Image source={{ uri: senderProfile.avatar }} className="h-full w-full" />
              ) : (
                <Text className="text-xs font-bold text-primary">
                  {(senderProfile?.username || item.senderUsername || '?')[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
          ) : null}
          <Pressable
            onPress={() => handleMessageTap(item)}
            onLongPress={() => handleDeleteMessage(item)}
            className={
              isEmojiOnly
                ? 'max-w-[75%]'
                : isMediaMessage
                  ? 'max-w-[75%]'
                  : `max-w-[64%] rounded-2xl px-3 py-2 ${
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
                onLongPress={() => handleDeleteMessage(item)}
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
                onLongPress={() => handleDeleteMessage(item)}
            >
              <InlineVideoPreview uri={item.mediaUrl} />
            </Pressable>
          ) : null}

          {!item.deletedForAll && item.type === 'audio' && item.mediaUrl ? (
            <AudioMessagePlayer
              uri={item.mediaUrl}
              durationMs={item.durationMs}
                onLongPress={() => handleDeleteMessage(item)}
            />
          ) : null}

          {!item.deletedForAll && item.type === 'sticker' && item.text ? (
            <Text className="text-6xl">{item.text}</Text>
          ) : null}

          {!item.deletedForAll && item.replyTo ? (
            <StoryReplyPreview replyTo={item.replyTo} isUser={isUser} />
          ) : null}

          {!item.deletedForAll && item.text && !isEmojiOnly ? (
            <View className={item.mediaUrl || item.type === 'sticker' ? 'mt-3' : ''}>
              <Text
                className={`text-base ${
                  isUser ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {item.text}
              </Text>
            </View>
          ) : null}

          {!item.deletedForAll && isEmojiOnly ? (
            <Text className="text-5xl leading-[56px]">{item.text}</Text>
          ) : null}
          </Pressable>
        </View>

        {!item.deletedForAll && item.type !== 'system' && groupedReactions.length > 0 ? (
          <View className={`${isUser ? '-mt-2 items-end pr-2' : '-mt-2 items-start pl-10'}`}>
            <View className="flex-row items-center rounded-full border border-border bg-card px-2 py-1 shadow-sm">
              {groupedReactions.map(([emoji, count]) => (
                <View key={emoji} className="mr-1 flex-row items-center">
                  <Text className="text-xs">{emoji}</Text>
                  {count > 1 ? (
                    <Text className="ml-1 text-[10px] font-semibold text-muted-foreground">{count}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!isGroupConversation && isLastOwnMessage && hasSeenLastOwnMessage ? (
          <View className="mt-1 mr-1 items-end">
            <View className="h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-primary/20">
              {friend?.avatar ? (
                <Image source={{ uri: friend.avatar }} className="h-full w-full" />
              ) : (
                <Text className="text-[9px] font-bold text-primary">
                  {friend?.username?.[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {isGroupConversation && isLastOwnMessage && groupSeenMembers.length > 0 ? (
          <View className="mt-1 mr-1 flex-row justify-end">
            {groupSeenMembers.slice(0, 6).map((member, index) => (
              <View
                key={member.id}
                className="h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-background bg-primary/20"
                style={{ marginLeft: index === 0 ? 0 : -4 }}
              >
                {member.avatar ? (
                  <Image source={{ uri: member.avatar }} className="h-full w-full" />
                ) : (
                  <Text className="text-[8px] font-bold text-primary">
                    {member.username?.[0]?.toUpperCase() || '?'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </SafeAreaView>
    );
  }

  const showSendButton = recorderState.isRecording || inputText.trim().length > 0;
  const displayMessages = [...messages].sort(
    (first, second) => first.createdAt - second.createdAt
  );
  const otherTypingUserIds = Object.entries(conversationInfo?.typingBy || {})
    .filter(([userId, isTyping]) => userId !== currentUser?.uid && isTyping)
    .map(([userId]) => userId);
  const typingLabel = isGroupConversation
    ? (() => {
        const typingNames = groupMembers
          .filter((member) => otherTypingUserIds.includes(member.id))
          .map((member) => member.username);
        if (typingNames.length === 0) return '';
        if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
        return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
      })()
    : otherTypingUserIds.length > 0
      ? `${friend?.username || 'Someone'} is typing...`
      : '';
  const otherUserSeenAt =
    !isGroupConversation && friend?.id
      ? conversationInfo?.lastSeenBy?.[friend.id] || 0
      : 0;
  const lastOwnMessageId = [...displayMessages]
    .reverse()
    .find((message) => message.senderId === currentUser?.uid && !message.deletedForAll)?.id;
  const lastOwnMessageTime =
    displayMessages.find((message) => message.id === lastOwnMessageId)?.createdAt || 0;
  const hasSeenLastOwnMessage =
    !isGroupConversation && Boolean(lastOwnMessageId) && otherUserSeenAt >= lastOwnMessageTime;
  const groupSeenMembers =
    isGroupConversation && Boolean(lastOwnMessageId)
      ? groupMembers.filter(
          (member) =>
            member.id !== currentUser?.uid &&
            (conversationInfo?.lastSeenBy?.[member.id] || 0) >= lastOwnMessageTime
        )
      : [];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isNearBottomRef.current = event.nativeEvent.contentOffset.y < 80;
  };

  const openFriendProfile = () => {
    if (!friend || isGroupConversation) {
      return;
    }

    router.push({ pathname: '/user/[id]', params: { id: friend.id } });
  };

  const openConversationDetails = () => {
    if (!conversationId) {
      return;
    }

    router.push({
      pathname: '/chat-details/[id]',
      params: {
        id: conversationId,
        userId: !isGroupConversation && friend?.id ? friend.id : '',
      },
    });
  };

  const listData = [...displayMessages].reverse();
  const safeBottomInset = Math.max(insets.bottom, 12);
  const listBottomGap = composerHeight + keyboardHeight + 4;
  const activeStatusLabel = !isGroupConversation ? formatActiveStatus(friend, statusClock) : '';
  const displayFriendName =
    !isGroupConversation && friend?.id && conversationInfo?.nicknamesByUserId?.[friend.id]
      ? conversationInfo.nicknamesByUserId[friend.id]
      : friend?.username || 'Friend';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="-ml-2 p-2">
          <ArrowLeft className="text-foreground" size={24} />
        </TouchableOpacity>

        <View className="ml-2 flex-1 flex-row items-center">
          <TouchableOpacity
            onPress={openFriendProfile}
            disabled={isGroupConversation}
            activeOpacity={isGroupConversation ? 1 : 0.8}
          >
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
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openConversationDetails}
            activeOpacity={0.8}
            className="flex-1"
          >
          <View>
            <Text className="text-base font-semibold text-foreground">
              {displayFriendName}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {typingLabel || activeStatusLabel || (isGroupConversation ? `${groupMembers.length} members` : '')}
            </Text>
          </View>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={openConversationDetails}
            className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <MoreVertical className="text-foreground" size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1">
        <FlatList
          ref={listRef}
          data={listData}
          inverted
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingTop: listBottomGap,
            flexGrow: listData.length === 0 ? 1 : 0,
            justifyContent: listData.length === 0 ? 'flex-end' : 'flex-start',
          }}
          ListEmptyComponent={null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onTouchStart={closeComposerPanels}
          onScrollBeginDrag={closeComposerPanels}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (!didInitialScrollRef.current && listData.length > 0) {
              didInitialScrollRef.current = true;
              scrollToBottom(false);
              return;
            }

            if (sentByMeRef.current) {
              sentByMeRef.current = false;
              scrollToBottom(true);
              return;
            }

            if (isNearBottomRef.current) {
              scrollToBottom(false);
            }
          }}
        />

        <View
          onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          className="absolute inset-x-0 border-t border-border bg-background"
          style={{
            bottom: keyboardHeight,
            paddingBottom: safeBottomInset,
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
            {editingMessage ? (
              <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-[#E9D5FF] bg-[#FAF5FF] px-4 py-3">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[#7C3AED]">
                    Editing message
                  </Text>
                  <Text numberOfLines={1} className="mt-1 text-sm text-foreground">
                    {editingMessage.text}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}>
                  <Text className="font-semibold text-[#7C3AED]">Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}

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
                  ref={inputRef}
                  value={inputText}
                  onChangeText={(value) => {
                    setInputText(value);
                    const isTyping = value.trim().length > 0;
                    setTypingState(isTyping);
                    if (isTyping) {
                      scheduleTypingReset();
                    }
                  }}
                  onFocus={closeComposerPanels}
                  onBlur={() => setTypingState(false)}
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

      <ThemedActionSheet
        visible={Boolean(actionSheetConfig)}
        title={actionSheetConfig?.title || ''}
        message={actionSheetConfig?.message}
        reactions={actionSheetConfig?.reactions || []}
        options={actionSheetConfig?.options || []}
        onClose={() => setActionSheetConfig(null)}
      />
    </SafeAreaView>
  );
}


