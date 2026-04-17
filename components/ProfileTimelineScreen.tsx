import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Grid3X3,
  Heart,
  MessageCircle,
  PencilLine,
  Send,
  Trash2,
  User,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import {
  addProfilePostComment,
  createFriendRequest,
  createProfilePost,
  deleteProfilePost,
  deleteProfilePostComment,
  getUserConnectionState,
  sendConversationMediaMessage,
  sendConversationMessage,
  subscribeToFriendCount,
  subscribeToFriends,
  subscribeToProfilePostCommentLikes,
  subscribeToProfilePostComments,
  subscribeToProfilePostLikes,
  subscribeToProfilePosts,
  subscribeToUserProfile,
  toggleProfilePostCommentLike,
  toggleProfilePostLike,
  unfriendConversation,
  updateProfilePostComment,
  type FriendSummary,
  type FoundUser,
  type ProfilePost,
  type ProfilePostComment,
  type ProfilePostCommentLike,
  type ProfilePostLike,
  type UserConnectionState,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { sendMessagePushNotification, sendUserPushNotification } from '@/lib/push-api';
import { useThemedAlert } from '@/components/themed-alert-provider';

type ProfileTimelineScreenProps = {
  profileUserId?: string | null;
  showBackButton?: boolean;
  initialPostId?: string | null;
};

const formatCountLabel = (count: number, singular: string, plural: string) =>
  `${count}\n${count === 1 ? singular : plural}`;
const GRID_GAP = 2;
const GRID_TILE_SIZE = Math.floor((Dimensions.get('window').width - GRID_GAP * 2) / 3);
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const POST_IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.56, SCREEN_WIDTH * 1.18);

const formatRelativeTime = (timestamp: number) => {
  if (!timestamp) return 'Just now';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays >= 1) return `${diffDays}d`;
  if (diffHours >= 1) return `${diffHours}h`;
  if (diffMinutes >= 1) return `${diffMinutes}m`;
  return 'now';
};

export function ProfileTimelineScreen({
  profileUserId,
  showBackButton = false,
  initialPostId = null,
}: ProfileTimelineScreenProps) {
  const router = useRouter();
  const { showAlert, showConfirm, showActionSheet } = useThemedAlert();
  const insets = useSafeAreaInsets();
  const lastTapByPostRef = useRef<Record<string, number>>({});
  const lastTapByCommentRef = useRef<Record<string, number>>({});

  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(
    profileUserId || auth.currentUser?.uid || null
  );
  const [profile, setProfile] = useState<FoundUser | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [currentUserFriends, setCurrentUserFriends] = useState<FriendSummary[]>([]);
  const [connectionState, setConnectionState] = useState<UserConnectionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isFriendsModalVisible, setIsFriendsModalVisible] = useState(false);
  const [isUploadingPost, setIsUploadingPost] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [activePostIndex, setActivePostIndex] = useState<number | null>(null);
  const [activeCommentsPost, setActiveCommentsPost] = useState<ProfilePost | null>(null);
  const [activeLikesPost, setActiveLikesPost] = useState<ProfilePost | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<ProfilePost | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ProfilePostComment | null>(null);
  const [editingComment, setEditingComment] = useState<ProfilePostComment | null>(null);
  const [sharingFriendId, setSharingFriendId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [likesByPostId, setLikesByPostId] = useState<Record<string, ProfilePostLike[]>>({});
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, ProfilePostComment[]>>(
    {}
  );
  const [commentLikesByCommentId, setCommentLikesByCommentId] = useState<
    Record<string, ProfilePostCommentLike[]>
  >({});

  useEffect(() => {
    const unsubscribe = subscribeToAuthProfile((user) => {
      setCurrentUserId(user?.uid || null);
      setResolvedUserId(profileUserId || user?.uid || null);
    });

    return unsubscribe;
  }, [profileUserId]);

  useEffect(() => {
    if (!resolvedUserId) {
      setProfile(null);
      setFriendCount(0);
      setPosts([]);
      setLikesByPostId({});
      setCommentsByPostId({});
      setCommentLikesByCommentId({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribeProfile = subscribeToUserProfile(resolvedUserId, (nextProfile) => {
      setProfile(nextProfile);
      setIsLoading(false);
    });
    const unsubscribeFriendCount = subscribeToFriendCount(resolvedUserId, setFriendCount);
    const unsubscribePosts = subscribeToProfilePosts(resolvedUserId, setPosts);

    return () => {
      unsubscribeProfile();
      unsubscribeFriendCount();
      unsubscribePosts();
    };
  }, [resolvedUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserFriends([]);
      return;
    }

    const unsubscribeFriends = subscribeToFriends(currentUserId, setCurrentUserFriends);
    return unsubscribeFriends;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !resolvedUserId || currentUserId === resolvedUserId) {
      setConnectionState(null);
      return;
    }

    void getUserConnectionState(currentUserId, resolvedUserId)
      .then(setConnectionState)
      .catch(() => {
        setConnectionState(null);
      });
  }, [currentUserId, resolvedUserId, friendCount]);

  useEffect(() => {
    if (!currentUserId || posts.length === 0) {
      setLikesByPostId({});
      setCommentsByPostId({});
      return;
    }

    const unsubscribes = posts.flatMap((post) => [
      subscribeToProfilePostLikes(post.id, (likes) => {
        setLikesByPostId((currentLikes) => ({
          ...currentLikes,
          [post.id]: likes,
        }));
      }),
      subscribeToProfilePostComments(post.id, (comments) => {
        setCommentsByPostId((currentComments) => ({
          ...currentComments,
          [post.id]: comments,
        }));
      }),
    ]);

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [currentUserId, posts]);

  useEffect(() => {
    if (!initialPostId || posts.length === 0) {
      return;
    }

    const targetIndex = posts.findIndex((post) => post.id === initialPostId);
    if (targetIndex >= 0) {
      setActivePostIndex(targetIndex);
    }
  }, [initialPostId, posts]);

  useEffect(() => {
    if (!currentUserId || !activeCommentsPost) {
      setCommentLikesByCommentId({});
      return;
    }

    const activeComments = commentsByPostId[activeCommentsPost.id] || [];
    if (activeComments.length === 0) {
      setCommentLikesByCommentId({});
      return;
    }

    const unsubscribes = activeComments.map((comment) =>
      subscribeToProfilePostCommentLikes(activeCommentsPost.id, comment.id, (likes) => {
        setCommentLikesByCommentId((currentLikes) => ({
          ...currentLikes,
          [comment.id]: likes,
        }));
      })
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeCommentsPost, commentsByPostId, currentUserId]);

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

  const isOwner = Boolean(currentUserId && resolvedUserId && currentUserId === resolvedUserId);
  const canCommentOnPosts = Boolean(isOwner || connectionState?.isFriend);
  const activeFeedPosts = activePostIndex !== null ? posts.slice(activePostIndex) : [];
  const commentSheetLift = keyboardHeight > 0 ? Math.max(keyboardHeight - insets.bottom, 0) : 0;
  const activeCommentEntries = activeCommentsPost ? commentsByPostId[activeCommentsPost.id] || [] : [];
  const rootComments = activeCommentEntries.filter((comment) => !comment.parentCommentId);
  const repliesByParentId = activeCommentEntries.reduce<Record<string, ProfilePostComment[]>>(
    (accumulator, comment) => {
      if (comment.parentCommentId) {
        accumulator[comment.parentCommentId] = accumulator[comment.parentCommentId] || [];
        accumulator[comment.parentCommentId].push(comment);
      }
      return accumulator;
    },
    {}
  );
  const stats = useMemo(
    () => [
      { key: 'posts', label: formatCountLabel(posts.length, 'post', 'posts') },
      {
        key: 'stories',
        label: formatCountLabel(profile?.totalStoriesPosted || 0, 'story', 'stories'),
      },
      { key: 'friends', label: formatCountLabel(friendCount, 'friend', 'friends') },
    ],
    [friendCount, posts.length, profile?.totalStoriesPosted]
  );

  const closeCreateModal = () => {
    setIsCreateModalVisible(false);
    setSelectedImageUrl('');
    setPostCaption('');
  };

  const openCommentsForPost = (post: ProfilePost) => {
    setReplyTarget(null);
    setEditingComment(null);
    setCommentDraft('');
    setActiveCommentsPost(post);
  };

  const closeCommentsModal = () => {
    setActiveCommentsPost(null);
    setReplyTarget(null);
    setEditingComment(null);
    setCommentDraft('');
  };

  const handlePickPostImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        showAlert('Permission needed', 'Please allow gallery access to create posts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      setIsUploadingPost(true);
      const upload = await uploadToCloudinary({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        folder: 'velora/profile-posts',
      });

      setSelectedImageUrl(upload.url);
    } catch {
      showAlert('Error', 'Failed to pick your post image.');
    } finally {
      setIsUploadingPost(false);
    }
  };

  const handleCreatePost = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !selectedImageUrl) {
      return;
    }

    try {
      setIsUploadingPost(true);
      await createProfilePost(currentUser, {
        imageUrl: selectedImageUrl,
        caption: postCaption,
      });
      setPosts((currentPosts) => [
        {
          id: `local-${Date.now()}`,
          ownerId: currentUser.uid,
          ownerUsername: profile?.username || currentUser.displayName || 'You',
          ownerAvatar: profile?.avatar || currentUser.photoURL || '',
          imageUrl: selectedImageUrl,
          caption: postCaption.trim(),
          createdAt: Date.now(),
        },
        ...currentPosts.filter((post) => post.imageUrl !== selectedImageUrl),
      ]);
      closeCreateModal();
    } catch {
      showAlert('Error', 'Failed to publish your post.');
    } finally {
      setIsUploadingPost(false);
    }
  };

  const handleDeletePost = async (post: ProfilePost) => {
    if (!currentUserId) {
      return;
    }

    showConfirm({
      title: 'Delete post',
      message: 'This will permanently remove the post from your profile.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteProfilePost(post.id, currentUserId);
          setActiveCommentsPost((currentPost) =>
            currentPost?.id === post.id ? null : currentPost
          );
          setActiveLikesPost((currentPost) =>
            currentPost?.id === post.id ? null : currentPost
          );
          setActiveSharePost((currentPost) =>
            currentPost?.id === post.id ? null : currentPost
          );
          setActivePostIndex((currentIndex) => {
            if (currentIndex === null) return currentIndex;
            return activeFeedPosts.length <= 1 ? null : currentIndex;
          });
        } catch {
          showAlert('Error', 'Failed to delete this post.');
        }
      },
    });
  };

  const handleAddFriend = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !profile || !resolvedUserId || currentUser.uid === resolvedUserId) {
      return;
    }

    try {
      await createFriendRequest(currentUser, {
        id: profile.id,
        username: profile.username,
        avatar: profile.avatar,
        email: profile.email,
        bio: profile.bio,
      });
      await sendUserPushNotification({
        recipientUserIds: [profile.id],
        title: `${currentUser.displayName?.trim() || 'Someone'} sent you a friend request`,
        body: 'Open Velora to accept or decline it.',
        data: {
          screen: 'friends',
          type: 'friend-request',
        },
      }).catch(() => {});
      setConnectionState((currentState) =>
        currentState
          ? { ...currentState, outgoingFriendRequest: true }
          : {
              isFriend: false,
              hasDirectMessage: false,
              outgoingFriendRequest: true,
              incomingFriendRequest: false,
              outgoingMessageRequest: false,
              incomingMessageRequest: false,
            }
      );
    } catch {
      showAlert('Error', 'Failed to send friend request.');
    }
  };

  const handleOpenMessage = () => {
    if (!resolvedUserId || !currentUserId || currentUserId === resolvedUserId) {
      return;
    }

    router.push({ pathname: '/chat/[id]', params: { id: resolvedUserId } });
  };

  const handleRemoveFriend = async () => {
    if (!currentUserId || !resolvedUserId) {
      return;
    }

    showConfirm({
      title: 'Remove friend',
      message: `Remove ${profile?.username || 'this user'} from your friends?`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await unfriendConversation(
            [currentUserId, resolvedUserId].sort().join('__'),
            currentUserId
          );
          setConnectionState((currentState) =>
            currentState
              ? {
                  ...currentState,
                  isFriend: false,
                  hasDirectMessage: false,
                  outgoingFriendRequest: false,
                  incomingFriendRequest: false,
                }
              : currentState
          );
        } catch {
          showAlert('Error', 'Failed to remove this friend.');
        }
      },
    });
  };

  const handleToggleLike = async (post: ProfilePost) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    const existingLikes = likesByPostId[post.id] || [];
    const alreadyLiked = existingLikes.some((like) => like.userId === currentUser.uid);

    setLikesByPostId((currentLikes) => ({
      ...currentLikes,
      [post.id]: alreadyLiked
        ? existingLikes.filter((like) => like.userId !== currentUser.uid)
        : [
            ...existingLikes,
            {
              userId: currentUser.uid,
              username: currentUser.displayName?.trim() || profile?.username || 'You',
              avatar: currentUser.photoURL || profile?.avatar || '',
              createdAt: Date.now(),
            },
          ],
    }));

    try {
      await toggleProfilePostLike(currentUser, post.id);
    } catch {
      setLikesByPostId((currentLikes) => ({
        ...currentLikes,
        [post.id]: existingLikes,
      }));
      showAlert('Error', 'Failed to update like.');
    }
  };

  const handleImageTap = (post: ProfilePost) => {
    const now = Date.now();
    const previousTapAt = lastTapByPostRef.current[post.id] || 0;
    lastTapByPostRef.current[post.id] = now;

    if (now - previousTapAt <= 280) {
      void handleToggleLike(post);
    }
  };

  const handleSubmitComment = async () => {
    const currentUser = auth.currentUser;
    const post = activeCommentsPost;
    const trimmedComment = commentDraft.trim();

    if (!currentUser || !post || !trimmedComment) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      if (editingComment) {
        await updateProfilePostComment(currentUser, post.id, editingComment.id, trimmedComment);
      } else {
        await addProfilePostComment(currentUser, post.id, trimmedComment, {
          parentCommentId: replyTarget?.parentCommentId || replyTarget?.id || null,
          replyToUsername: replyTarget?.username || null,
        });
      }
      setCommentDraft('');
      setReplyTarget(null);
      setEditingComment(null);
    } catch (error: any) {
      showAlert('Error', error?.message || "Only you and this user's friends can comment on this post.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (post: ProfilePost, comment: ProfilePostComment) => {
    if (!currentUserId) {
      return;
    }

    const canDelete = comment.userId === currentUserId || post.ownerId === currentUserId;
    if (!canDelete) {
      return;
    }

    try {
      await deleteProfilePostComment(post.id, comment.id);
    } catch {
      showAlert('Error', 'Failed to delete this comment.');
    }
  };

  const handleCommentLongPress = (post: ProfilePost, comment: ProfilePostComment) => {
    if (!currentUserId) {
      return;
    }

    const isCommentOwner = comment.userId === currentUserId;
    const canDelete = isCommentOwner || post.ownerId === currentUserId;
    if (!canDelete) {
      return;
    }

    const actions = [
      {
        label: 'Delete comment',
        destructive: true,
        onPress: () => {
          void handleDeleteComment(post, comment);
        },
      },
    ];

    if (isCommentOwner) {
      actions.unshift({
        label: 'Edit comment',
        onPress: () => {
          setReplyTarget(null);
          setEditingComment(comment);
          setCommentDraft(comment.text);
        },
      });
    }

    showActionSheet('Comment options', 'What would you like to do?', actions);
  };

  const handleReplyToComment = (comment: ProfilePostComment) => {
    setEditingComment(null);
    setReplyTarget(comment);
    setCommentDraft('');
  };

  const handleToggleCommentLike = async (post: ProfilePost, comment: ProfilePostComment) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    const existingLikes = commentLikesByCommentId[comment.id] || [];
    const alreadyLiked = existingLikes.some((like) => like.userId === currentUser.uid);

    setCommentLikesByCommentId((currentLikes) => ({
      ...currentLikes,
      [comment.id]: alreadyLiked
        ? existingLikes.filter((like) => like.userId !== currentUser.uid)
        : [
            ...existingLikes,
            {
              userId: currentUser.uid,
              username: currentUser.displayName?.trim() || profile?.username || 'You',
              avatar: currentUser.photoURL || profile?.avatar || '',
              createdAt: Date.now(),
            },
          ],
    }));

    try {
      await toggleProfilePostCommentLike(currentUser, post.id, comment.id);
    } catch {
      setCommentLikesByCommentId((currentLikes) => ({
        ...currentLikes,
        [comment.id]: existingLikes,
      }));
      showAlert('Error', 'Failed to update comment like.');
    }
  };

  const handleCommentTap = (post: ProfilePost, comment: ProfilePostComment) => {
    const now = Date.now();
    const previousTapAt = lastTapByCommentRef.current[comment.id] || 0;
    lastTapByCommentRef.current[comment.id] = now;

    if (now - previousTapAt <= 280) {
      void handleToggleCommentLike(post, comment);
    }
  };

  const handleSharePost = async (post: ProfilePost, friend: FriendSummary) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    try {
      setSharingFriendId(friend.id);
      await sendConversationMediaMessage(currentUser, friend.conversationId, {
        type: 'image',
        mediaUrl: post.imageUrl,
      });
      await sendConversationMessage(
        currentUser,
        friend.conversationId,
        post.caption
          ? `Shared ${post.ownerUsername}'s post\n${post.caption}`
          : `Shared ${post.ownerUsername}'s post`
      );
      await sendMessagePushNotification({
        conversationId: friend.conversationId,
        senderName: currentUser.displayName?.trim() || currentUser.email?.split('@')[0] || 'Someone',
        messageType: 'image',
      }).catch(() => {});
      setActiveSharePost(null);
    } catch {
      showAlert('Error', 'Failed to share this post.');
    } finally {
      setSharingFriendId(null);
    }
  };

  const renderAvatar = () => (
    <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-primary/15">
      {profile?.avatar ? (
        <Image source={{ uri: profile.avatar }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <User size={36} color="#8B5CF6" />
      )}
    </View>
  );

  const renderFriendAvatar = (friend: {
    username: string;
    avatar?: string;
  }) => (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/15">
      {friend.avatar ? (
        <Image source={{ uri: friend.avatar }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <Text className="text-base font-bold text-primary">
          {friend.username.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );

  const openUserProfile = (userId: string) => {
    if (!userId) {
      return;
    }

    if (userId === currentUserId) {
      router.push('/(tabs)/profile');
      return;
    }

    router.push({ pathname: '/user/[id]', params: { id: userId } });
  };

  const renderCommentRow = (comment: ProfilePostComment, isReply = false) => {
    if (!activeCommentsPost) {
      return null;
    }

    const commentLikes = commentLikesByCommentId[comment.id] || [];
    const currentUserLikedComment = commentLikes.some((like) => like.userId === currentUserId);
    const replies = isReply ? [] : repliesByParentId[comment.id] || [];

    return (
      <View key={comment.id} className={isReply ? 'mt-3 ml-12' : 'mb-5'}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => handleCommentTap(activeCommentsPost, comment)}
          onLongPress={() => handleCommentLongPress(activeCommentsPost, comment)}
          className="flex-row gap-3"
        >
          <TouchableOpacity activeOpacity={0.8} onPress={() => openUserProfile(comment.userId)}>
            {renderFriendAvatar(comment)}
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">{comment.username}</Text>
            <Text className="mt-1 text-sm leading-6 text-foreground">
              {comment.replyToUsername ? (
                <Text className="font-semibold text-primary">@{comment.replyToUsername} </Text>
              ) : null}
              {comment.text}
            </Text>

            <View className="mt-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Text className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                  {comment.editedAt ? ' • edited' : ''}
                </Text>
                <TouchableOpacity onPress={() => handleReplyToComment(comment)}>
                  <Text className="text-xs font-semibold text-muted-foreground">Reply</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  void handleToggleCommentLike(activeCommentsPost, comment);
                }}
                className="flex-row items-center gap-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Heart
                  size={15}
                  color={currentUserLikedComment ? '#F43F5E' : '#9CA3AF'}
                  fill={currentUserLikedComment ? '#F43F5E' : 'transparent'}
                />
                {commentLikes.length > 0 ? (
                  <Text className="text-[11px] font-semibold text-rose-500">
                    {commentLikes.length}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {replies.length > 0 ? (
          <View className="mt-1">
            {replies.map((reply) => renderCommentRow(reply, true))}
          </View>
        ) : null}
      </View>
    );
  };

  const handleFriendLongPress = (friend: FriendSummary) => {
    if (!isOwner || !currentUserId) {
      return;
    }

    showActionSheet(friend.username, 'Choose what you want to do with this friend.', [
      {
        label: 'Unfriend',
        destructive: true,
        onPress: async () => {
          try {
            await unfriendConversation(friend.conversationId, currentUserId);
          } catch {
            showAlert('Error', 'Failed to remove this friend.');
          }
        },
      },
    ]);
  };

  const renderPostTile = ({ item, index }: { item: ProfilePost; index: number }) => (
    <TouchableOpacity
      onPress={() => setActivePostIndex(index)}
      activeOpacity={0.9}
      style={{
        width: GRID_TILE_SIZE,
        height: GRID_TILE_SIZE,
        marginRight: index % 3 === 2 ? 0 : GRID_GAP,
        marginBottom: GRID_GAP,
      }}
    >
      <Image
        source={{ uri: item.imageUrl }}
        style={{ width: '100%', height: '100%', backgroundColor: '#E5E7EB' }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderFeedPost = ({ item }: { item: ProfilePost }) => {
    const likes = likesByPostId[item.id] || [];
    const comments = commentsByPostId[item.id] || [];
    const currentUserLike = likes.some((like) => like.userId === currentUserId);

    return (
      <View className="pb-10">
        <View className="mb-4 flex-row items-center justify-between px-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/15">
              {item.ownerAvatar ? (
                <Image source={{ uri: item.ownerAvatar }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Text className="text-lg font-bold text-white">
                  {item.ownerUsername.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text className="text-base font-semibold text-white">{item.ownerUsername}</Text>
              <Text className="text-xs text-white/60">{formatRelativeTime(item.createdAt)}</Text>
            </View>
          </View>

          {isOwner ? (
            <TouchableOpacity
              onPress={() => handleDeletePost(item)}
              className="rounded-full bg-white/10 p-2.5"
            >
              <Trash2 size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Pressable onPress={() => handleImageTap(item)}>
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: SCREEN_WIDTH, height: POST_IMAGE_HEIGHT, backgroundColor: '#111111' }}
            resizeMode="cover"
          />
        </Pressable>

        <View className="px-4 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-5">
              <TouchableOpacity
                onPress={() => void handleToggleLike(item)}
                onLongPress={() => setActiveLikesPost(item)}
                className="flex-row items-center gap-2"
              >
                <Heart
                  size={24}
                  color={currentUserLike ? '#F43F5E' : '#FFFFFF'}
                  fill={currentUserLike ? '#F43F5E' : 'transparent'}
                />
                <Text className="font-semibold text-white">{likes.length}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openCommentsForPost(item)}
                className="flex-row items-center gap-2"
              >
                <MessageCircle size={24} color="#FFFFFF" />
                <Text className="font-semibold text-white">{comments.length}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSharePost(item)}
                className="flex-row items-center gap-2"
              >
                <Send size={22} color="#FFFFFF" />
                <Text className="font-semibold text-white">Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {item.caption ? (
            <Text className="mb-3 text-base leading-6 text-white">
              <Text className="font-semibold text-white">{item.ownerUsername} </Text>
              {item.caption}
            </Text>
          ) : null}

          {comments.length > 0 ? (
            <TouchableOpacity onPress={() => openCommentsForPost(item)}>
              <Text className="mb-2 text-sm text-white/70">
                View comments ({comments.length})
              </Text>
              {comments.slice(-2).map((comment) => (
                <Text key={comment.id} className="mb-1 text-sm text-white/85">
                  <Text className="font-semibold text-white">{comment.username} </Text>
                  {comment.text}
                </Text>
              ))}
            </TouchableOpacity>
          ) : null}
        </View>
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-6">
          {showBackButton ? (
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-5 h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
            >
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ) : null}

          <View className="flex-row items-start gap-5">
            {renderAvatar()}

            <View className="flex-1 pt-2">
              <Text className="text-2xl font-bold text-foreground">{profile?.username || 'User'}</Text>
              <View className="mt-4 flex-row items-start gap-4">
                {stats.map((stat) => (
                  <TouchableOpacity
                    key={stat.key}
                    disabled={!isOwner || stat.key !== 'friends'}
                    onPress={() => {
                      if (isOwner && stat.key === 'friends') {
                        setIsFriendsModalVisible(true);
                      }
                    }}
                    className="flex-1 items-center"
                  >
                    <Text className="text-center text-lg font-semibold text-foreground">
                      {stat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View className="mt-5">
            <Text className="mt-1 text-sm leading-6 text-muted-foreground">
              {profile?.bio?.trim() || (isOwner ? 'Add a bio from Edit Profile.' : 'No bio yet.')}
            </Text>
          </View>

          <View className="mt-6 flex-row justify-between">
            {isOwner ? (
              <>
                <TouchableOpacity
                  onPress={() => router.push('/edit-profile')}
                  className="h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4"
                  style={{ width: '48.5%' }}
                >
                  <PencilLine size={18} color="#111827" />
                  <Text className="font-semibold text-foreground">Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsCreateModalVisible(true)}
                  className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-4"
                  style={{ width: '48.5%' }}
                >
                  <Camera size={18} color="#FFFFFF" />
                  <Text className="font-semibold text-primary-foreground">Create</Text>
                </TouchableOpacity>
              </>
            ) : connectionState?.isFriend ? (
              <>
                <TouchableOpacity
                  onPress={handleRemoveFriend}
                  className="h-14 items-center justify-center rounded-2xl border border-border bg-card px-4"
                  style={{ width: '48.5%' }}
                >
                  <Text className="text-center font-semibold text-foreground">Remove Friend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleOpenMessage}
                  className="h-14 items-center justify-center rounded-2xl bg-primary px-4"
                  style={{ width: '48.5%' }}
                >
                  <Text className="text-center font-semibold text-primary-foreground">Message</Text>
                </TouchableOpacity>
              </>
            ) : connectionState?.hasDirectMessage ? (
              <TouchableOpacity
                onPress={handleOpenMessage}
                className="h-14 items-center justify-center rounded-2xl bg-primary px-4"
                style={{ width: '100%' }}
              >
                <Text className="text-center font-semibold text-primary-foreground">Message</Text>
              </TouchableOpacity>
            ) : !connectionState?.isFriend ? (
              <TouchableOpacity
                onPress={handleAddFriend}
                disabled={Boolean(connectionState?.outgoingFriendRequest || connectionState?.incomingFriendRequest)}
                className={`h-14 items-center justify-center rounded-2xl px-4 ${
                  connectionState?.outgoingFriendRequest || connectionState?.incomingFriendRequest
                    ? 'bg-muted'
                    : 'bg-primary'
                }`}
                style={{ width: '100%' }}
              >
                <Text
                  className={`text-center font-semibold ${
                    connectionState?.outgoingFriendRequest || connectionState?.incomingFriendRequest
                      ? 'text-muted-foreground'
                      : 'text-primary-foreground'
                  }`}
                >
                  {connectionState?.incomingFriendRequest
                    ? 'Review Friend Request'
                    : connectionState?.outgoingFriendRequest
                      ? 'Friend Request Sent'
                      : 'Add Friend'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View className="mt-8 border-t border-border pt-4">
          <View className="mb-4 flex-row items-center justify-center gap-2">
            <Grid3X3 size={18} color="#111827" />
            <Text className="text-sm font-semibold tracking-[1.5px] text-foreground">POSTS</Text>
          </View>

          {posts.length > 0 ? (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPostTile}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={{ paddingHorizontal: 0 }}
              columnWrapperStyle={{ justifyContent: 'flex-start' }}
            />
          ) : (
            <View className="items-center px-10 py-16">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                <Camera size={36} color="#8B5CF6" />
              </View>
              <Text className="text-3xl font-bold text-foreground">
                {isOwner ? 'Create your first post' : 'No posts yet'}
              </Text>
              <Text className="mt-3 text-center text-base leading-7 text-muted-foreground">
                {isOwner
                  ? 'Make this space your own with permanent profile photos.'
                  : `${profile?.username || 'This user'} has not posted anything yet.`}
              </Text>
              {isOwner ? (
                <TouchableOpacity
                  onPress={() => setIsCreateModalVisible(true)}
                  className="mt-8 rounded-2xl bg-primary px-8 py-4"
                >
                  <Text className="text-lg font-semibold text-primary-foreground">Create</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <Pressable className="flex-1 bg-black/40" onPress={closeCreateModal}>
          <Pressable className="mt-auto rounded-t-[32px] bg-background px-6 pb-10 pt-6">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Create Post</Text>
              <TouchableOpacity
                onPress={closeCreateModal}
                className="rounded-full bg-secondary px-3 py-2"
              >
                <Text className="font-semibold text-foreground">Close</Text>
              </TouchableOpacity>
            </View>

            {selectedImageUrl ? (
              <Image
                source={{ uri: selectedImageUrl }}
                className="mb-4 h-72 w-full rounded-3xl bg-muted"
                resizeMode="cover"
              />
            ) : (
              <TouchableOpacity
                onPress={handlePickPostImage}
                disabled={isUploadingPost}
                className="mb-4 items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-12"
              >
                <Camera size={28} color="#8B5CF6" />
                <Text className="mt-4 text-lg font-semibold text-foreground">Choose a photo</Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Upload a permanent post to your profile grid.
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handlePickPostImage}
              disabled={isUploadingPost}
              className="mb-4 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <Text className="text-center font-semibold text-foreground">
                {selectedImageUrl ? 'Change photo' : 'Pick photo'}
              </Text>
            </TouchableOpacity>

            <TextInput
              value={postCaption}
              onChangeText={setPostCaption}
              placeholder="Write a caption..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={220}
              className="min-h-[120px] rounded-2xl border border-border bg-input px-4 py-4 text-base text-foreground"
            />

            <TouchableOpacity
              onPress={handleCreatePost}
              disabled={isUploadingPost || !selectedImageUrl}
              className={`mt-4 rounded-2xl px-4 py-4 ${
                isUploadingPost || !selectedImageUrl ? 'bg-muted' : 'bg-primary'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  isUploadingPost || !selectedImageUrl
                    ? 'text-muted-foreground'
                    : 'text-primary-foreground'
                }`}
              >
                {isUploadingPost ? 'Publishing...' : 'Publish Post'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={activePostIndex !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActivePostIndex(null)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between border-b border-white/10 px-4 py-4">
            <TouchableOpacity onPress={() => setActivePostIndex(null)} className="mr-4">
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="flex-1 text-2xl font-bold text-white">Posts</Text>
            <View className="w-6" />
          </View>

          <FlatList
            data={activeFeedPosts}
            keyExtractor={(item) => item.id}
            renderItem={renderFeedPost}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(activeCommentsPost)}
        transparent
        animationType="slide"
        onRequestClose={closeCommentsModal}
      >
        <View className="flex-1 justify-end bg-black/55">
          <Pressable className="absolute inset-0" onPress={closeCommentsModal} />
          <Pressable
            className="rounded-t-[30px] bg-background pt-4"
            style={{
              maxHeight: SCREEN_HEIGHT * 0.74,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: -commentSheetLift }],
            }}
          >
            <View className="mb-4 items-center">
              <View className="h-1.5 w-14 rounded-full bg-border" />
            </View>
            <View className="border-b border-border px-6 pb-4">
              <Text className="text-center text-2xl font-bold text-foreground">Comments</Text>
            </View>

            <FlatList
              data={rootComments}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: SCREEN_HEIGHT * (keyboardHeight > 0 ? 0.24 : 0.36) }}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 18,
                paddingBottom: 18,
              }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="items-center py-10">
                  <Text className="text-base font-semibold text-foreground">No comments yet</Text>
                  <Text className="mt-2 text-sm text-muted-foreground">
                    Start the conversation on this post.
                  </Text>
                </View>
              }
              renderItem={({ item }) => renderCommentRow(item)}
            />

            <View
              className="border-t border-border px-5 pt-4"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {replyTarget || editingComment ? (
                <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-semibold uppercase tracking-[1px] text-primary">
                      {editingComment ? 'Editing comment' : `Replying to ${replyTarget?.username}`}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                      {editingComment ? editingComment?.text : replyTarget?.text}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyTarget(null);
                      setEditingComment(null);
                      setCommentDraft('');
                    }}
                  >
                    <Text className="font-semibold text-foreground">Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {canCommentOnPosts ? (
                <View className="flex-row items-end gap-3">
                  <View className="min-h-[48px] flex-1 justify-center rounded-2xl border border-border bg-input px-4">
                    <TextInput
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      placeholder="Join the conversation..."
                      placeholderTextColor="#9CA3AF"
                      className="py-3 text-base text-foreground"
                      multiline
                      maxLength={300}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleSubmitComment}
                    disabled={isSubmittingComment || !commentDraft.trim()}
                    className={`h-12 w-12 items-center justify-center rounded-full ${
                      isSubmittingComment || !commentDraft.trim() ? 'bg-muted' : 'bg-primary'
                    }`}
                  >
                    <Send
                      size={18}
                      color={isSubmittingComment || !commentDraft.trim() ? '#9CA3AF' : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text className="text-center text-sm text-muted-foreground">
                  Only friends can comment on this post.
                </Text>
              )}
            </View>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={Boolean(activeLikesPost)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveLikesPost(null)}
      >
        <Pressable className="flex-1 bg-black/55" onPress={() => setActiveLikesPost(null)}>
          <Pressable className="mt-auto rounded-t-[30px] bg-background px-6 pb-8 pt-4">
            <View className="mb-4 items-center">
              <View className="h-1.5 w-14 rounded-full bg-border" />
            </View>
            <Text className="mb-5 text-center text-2xl font-bold text-foreground">Likes</Text>

            <FlatList
              data={activeLikesPost ? likesByPostId[activeLikesPost.id] || [] : []}
              keyExtractor={(item) => item.userId}
              style={{ maxHeight: SCREEN_HEIGHT * 0.4 }}
              ListEmptyComponent={
                <View className="items-center py-10">
                  <Text className="text-base font-semibold text-foreground">No likes yet</Text>
                  <Text className="mt-2 text-sm text-muted-foreground">
                    Be the first one to like this post.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4">
                  {renderFriendAvatar(item)}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">{item.username}</Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      Liked {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(activeSharePost)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSharePost(null)}
      >
        <Pressable className="flex-1 bg-black/55" onPress={() => setActiveSharePost(null)}>
          <Pressable className="mt-auto rounded-t-[30px] bg-background px-6 pb-8 pt-4">
            <View className="mb-4 items-center">
              <View className="h-1.5 w-14 rounded-full bg-border" />
            </View>
            <Text className="text-center text-2xl font-bold text-foreground">Share Post</Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              {activeSharePost ? `Share ${activeSharePost.ownerUsername}'s post` : ''}
            </Text>

            {activeSharePost ? (
              <View className="my-5 flex-row items-center gap-4 rounded-3xl border border-border bg-card p-4">
                <Image
                  source={{ uri: activeSharePost.imageUrl }}
                  className="h-20 w-20 rounded-2xl"
                  resizeMode="cover"
                />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {activeSharePost.ownerUsername}
                  </Text>
                  {activeSharePost.caption ? (
                    <Text className="mt-1 text-sm leading-6 text-muted-foreground">
                      {activeSharePost.caption}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-sm text-muted-foreground">Photo post</Text>
                  )}
                </View>
              </View>
            ) : null}

            <FlatList
              data={currentUserFriends}
              keyExtractor={(item) => item.conversationId}
              style={{ maxHeight: SCREEN_HEIGHT * 0.42 }}
              ListEmptyComponent={
                <View className="items-center py-10">
                  <Text className="text-base font-semibold text-foreground">No friends to share with</Text>
                  <Text className="mt-2 text-sm text-muted-foreground">
                    Add friends first to share posts directly.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (activeSharePost) {
                      void handleSharePost(activeSharePost, item);
                    }
                  }}
                  disabled={sharingFriendId === item.id}
                  className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  {renderFriendAvatar(item)}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">{item.username}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-primary">
                    {sharingFriendId === item.id ? 'Sending...' : 'Send'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isFriendsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFriendsModalVisible(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setIsFriendsModalVisible(false)}>
          <Pressable className="mt-auto rounded-t-[32px] bg-background px-6 pb-10 pt-6">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Friends</Text>
              <TouchableOpacity
                onPress={() => setIsFriendsModalVisible(false)}
                className="rounded-full bg-secondary px-3 py-2"
              >
                <Text className="font-semibold text-foreground">Close</Text>
              </TouchableOpacity>
            </View>

            {currentUserFriends.length > 0 ? (
              <FlatList
                data={currentUserFriends}
                keyExtractor={(item) => item.conversationId}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setIsFriendsModalVisible(false);
                      router.push({ pathname: '/user/[id]', params: { id: item.id } });
                    }}
                    onLongPress={() => handleFriendLongPress(item)}
                    className="mb-3 flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    {renderFriendAvatar(item)}
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">{item.username}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View className="items-center px-8 py-12">
                <Text className="text-lg font-semibold text-foreground">No friends yet</Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Your accepted friends will show here.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

