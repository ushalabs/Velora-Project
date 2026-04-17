import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  setDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@firebase/firestore';
import type { User } from '@firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { sendUserPushNotification } from '@/lib/push-api';

export const db = getFirestore(firebaseApp);

export type AppUserProfile = {
  uid: string;
  email: string;
  username: string;
  usernameLower: string;
  avatar: string;
  bio?: string;
  totalStoriesPosted?: number;
  expoPushTokens?: string[];
  storyHiddenFriendIds?: string[];
  showActiveStatus?: boolean;
  isActive?: boolean;
  lastActiveAt?: number;
  usernameChangedAt?: number;
  createdAt?: number;
};

export type FoundUser = {
  id: string;
  username: string;
  avatar?: string;
  email?: string;
  bio?: string;
  totalStoriesPosted?: number;
  storyHiddenFriendIds?: string[];
  showActiveStatus?: boolean;
  isActive?: boolean;
  lastActiveAt?: number;
  usernameChangedAt?: number;
  createdAt?: number;
};

export type ProfilePost = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatar?: string;
  imageUrl: string;
  caption: string;
  createdAt: number;
};

export type ProfilePostLike = {
  userId: string;
  username: string;
  avatar?: string;
  createdAt: number;
};

export type ProfilePostComment = {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  text: string;
  parentCommentId?: string;
  replyToUsername?: string;
  createdAt: number;
  editedAt?: number;
};

export type ProfilePostCommentLike = {
  userId: string;
  username: string;
  avatar?: string;
  createdAt: number;
};

export type ConversationInfo = {
  id: string;
  type: 'direct' | 'group';
  title: string;
  avatar?: string;
  nicknamesByUserId?: Record<string, string>;
  memberIds: string[];
  adminIds: string[];
  hiddenFor?: string[];
  createdBy?: string;
  updatedAt: number;
  typingBy?: Record<string, boolean>;
  lastSeenBy?: Record<string, number>;
  unreadCountBy?: Record<string, number>;
  isFriend?: boolean;
  requestPending?: boolean;
  requestInitiatorId?: string;
  requestRecipientId?: string;
};

export type FriendSummary = {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  showActiveStatus?: boolean;
  isActive?: boolean;
  lastActiveAt?: number;
  conversationId: string;
  lastMessageText: string;
  updatedAt: number;
  unreadCount: number;
  lastMessageSenderId?: string;
  seenByOtherAt?: number;
  isFriend: boolean;
  requestPending: boolean;
  requestInitiatorId?: string;
  requestRecipientId?: string;
};

export type GroupSummary = {
  id: string;
  title: string;
  avatar?: string;
  memberCount: number;
  lastMessageText: string;
  updatedAt: number;
  unreadCount: number;
  lastMessageSenderId?: string;
  adminIds: string[];
};

export type ChatMessage = {
  id: string;
  clientMessageId?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'system';
  text: string;
  mediaUrl?: string;
  durationMs?: number;
  senderId: string;
  senderUsername?: string;
  createdAt: number;
  clientCreatedAt?: number;
  deletedForAll?: boolean;
  deletedFor?: string[];
  editedAt?: number;
  reactions?: Array<{
    userId: string;
    username: string;
    avatar?: string;
    emoji: string;
    reactedAt: number;
  }>;
  status?: 'sending' | 'sent' | 'failed';
  replyTo?: {
    type: 'story';
    ownerId: string;
    ownerUsername: string;
    storyType: StoryItem['type'];
    storyText?: string;
    storyMediaUrl?: string;
  };
};

export type FriendRequest = {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar?: string;
  receiverId: string;
  createdAt: number;
  lastMessageText?: string;
};

export type RelationshipState =
  | 'none'
  | 'friends'
  | 'outgoing-request'
  | 'incoming-request';

export type MessageRequest = {
  id: string;
  senderId: string;
  senderUsername: string;
  senderAvatar?: string;
  receiverId: string;
  createdAt: number;
  initialMessage: string;
};

export type UserConnectionState = {
  isFriend: boolean;
  hasDirectMessage: boolean;
  outgoingFriendRequest: boolean;
  incomingFriendRequest: boolean;
  outgoingMessageRequest: boolean;
  incomingMessageRequest: boolean;
};

export type StoryItem = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatar?: string;
  type: 'text' | 'image' | 'video';
  text: string;
  mediaUrl?: string;
  createdAt: number;
  expiresAt: number;
  views: StoryView[];
  likes: StoryLike[];
};

export type StoryFeedEntry = {
  ownerId: string;
  username: string;
  avatar?: string;
  stories: StoryItem[];
  latestAt: number;
  isOwn: boolean;
};

export type StoryView = {
  userId: string;
  username: string;
  avatar?: string;
  seenAt: number;
};

export type StoryLike = {
  userId: string;
  username: string;
  avatar?: string;
  likedAt: number;
};

export type AppNotificationType =
  | 'friend_request'
  | 'friend_accept'
  | 'message_request'
  | 'message_request_accept'
  | 'message_reaction'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'comment_like'
  | 'comment_mention'
  | 'story_reply'
  | 'story_like';

export type AppNotification = {
  id: string;
  recipientUserId: string;
  actorId: string;
  actorUsername: string;
  actorAvatar?: string;
  type: AppNotificationType;
  title: string;
  body: string;
  entityId?: string;
  secondaryEntityId?: string;
  targetUserId?: string;
  isRead: boolean;
  createdAt: number;
};

const getFallbackUsername = (user: Pick<User, 'displayName' | 'email'>) =>
  user.displayName?.trim() || user.email?.split('@')[0] || 'user';

export const getConversationId = (firstUserId: string, secondUserId: string) =>
  [firstUserId, secondUserId].sort().join('__');

const getFriendRequestId = (firstUserId: string, secondUserId: string) =>
  `request__${[firstUserId, secondUserId].sort().join('__')}`;

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return 0;
};

const getDisplayNameFromProfile = (profile?: Pick<FoundUser, 'username'> | null) =>
  profile?.username?.trim() || 'Someone';

const createNotificationDoc = async (options: {
  recipientUserId: string;
  actorId: string;
  actorUsername: string;
  actorAvatar?: string;
  type: AppNotificationType;
  title: string;
  body: string;
  entityId?: string;
  secondaryEntityId?: string;
  targetUserId?: string;
}) => {
  if (!options.recipientUserId || options.recipientUserId === options.actorId) {
    return;
  }

  await addDoc(collection(db, 'notifications'), {
    recipientUserId: options.recipientUserId,
    actorId: options.actorId,
    actorUsername: options.actorUsername,
    actorAvatar: options.actorAvatar || '',
    type: options.type,
    title: options.title,
    body: options.body,
    entityId: options.entityId || '',
    secondaryEntityId: options.secondaryEntityId || '',
    targetUserId: options.targetUserId || '',
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await sendUserPushNotification({
    recipientUserIds: [options.recipientUserId],
    title: options.title,
    body: options.body,
    data: {
      type: options.type,
      actorId: options.actorId,
      entityId: options.entityId || '',
      secondaryEntityId: options.secondaryEntityId || '',
      targetUserId: options.targetUserId || '',
    },
  }).catch(() => {});
};

const createMentionNotifications = async (options: {
  actor: User;
  text: string;
  fallbackRecipientIds?: string[];
  type: Extract<AppNotificationType, 'comment_mention'>;
  title: string;
  body: string;
  entityId?: string;
  secondaryEntityId?: string;
  targetUserId?: string;
}) => {
  const mentionMatches = options.text.match(/@([a-zA-Z0-9_]+)/g) || [];
  const usernames = Array.from(
    new Set(mentionMatches.map((mention) => mention.slice(1).trim().toLowerCase()).filter(Boolean))
  );

  if (usernames.length === 0) {
    return;
  }

  const snapshots = await Promise.all(
    usernames.map((username) =>
      getDocs(query(collection(db, 'users'), where('usernameLower', '==', username), limit(1)))
    )
  );

  const recipientIds = new Set<string>(options.fallbackRecipientIds || []);
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnapshot) => {
      recipientIds.add(docSnapshot.id);
    });
  });

  await Promise.all(
    Array.from(recipientIds).map((recipientUserId) =>
      createNotificationDoc({
        recipientUserId,
        actorId: options.actor.uid,
        actorUsername: getFallbackUsername(options.actor),
        actorAvatar: options.actor.photoURL || '',
        type: options.type,
        title: options.title,
        body: options.body,
        entityId: options.entityId,
        secondaryEntityId: options.secondaryEntityId,
        targetUserId: options.targetUserId,
      })
    )
  );
};

const toFoundUser = (snapshot: any): FoundUser => {
  const data = snapshot.data() as AppUserProfile;
  return {
    id: snapshot.id,
    username: data.username,
    avatar: data.avatar,
    email: data.email,
    bio: data.bio || '',
    totalStoriesPosted: typeof data.totalStoriesPosted === 'number' ? data.totalStoriesPosted : 0,
    storyHiddenFriendIds: Array.isArray(data.storyHiddenFriendIds)
      ? data.storyHiddenFriendIds.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    showActiveStatus: data.showActiveStatus !== false,
    isActive: Boolean(data.isActive),
    lastActiveAt:
      typeof data.lastActiveAt === 'number'
        ? data.lastActiveAt
        : toMillis(data.lastActiveAt),
    usernameChangedAt:
      typeof data.usernameChangedAt === 'number'
        ? data.usernameChangedAt
        : toMillis(data.usernameChangedAt),
    createdAt:
      typeof data.createdAt === 'number'
        ? data.createdAt
        : toMillis(data.createdAt),
  };
};

const toConversationInfo = (snapshot: any): ConversationInfo => {
  const data = snapshot.data();
  const typingByRaw = data.typingBy && typeof data.typingBy === 'object' ? data.typingBy : {};
  const lastSeenByRaw =
    data.lastSeenBy && typeof data.lastSeenBy === 'object' ? data.lastSeenBy : {};
  const unreadCountByRaw =
    data.unreadCountBy && typeof data.unreadCountBy === 'object' ? data.unreadCountBy : {};
  const nicknamesByUserIdRaw =
    data.nicknamesByUserId && typeof data.nicknamesByUserId === 'object' ? data.nicknamesByUserId : {};

  return {
    id: snapshot.id,
    type: data.type === 'group' ? 'group' : 'direct',
    title: data.title || 'Conversation',
    avatar: data.avatar || '',
    nicknamesByUserId: Object.fromEntries(
      Object.entries(nicknamesByUserIdRaw).map(([userId, value]) => [
        userId,
        typeof value === 'string' ? value : '',
      ])
    ),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
    adminIds: Array.isArray(data.adminIds) ? data.adminIds : [],
    hiddenFor: Array.isArray(data.hiddenFor) ? data.hiddenFor : [],
    createdBy: data.createdBy || '',
    updatedAt: toMillis(data.updatedAt),
    typingBy: Object.fromEntries(
      Object.entries(typingByRaw).map(([userId, value]) => [userId, Boolean(value)])
    ),
    lastSeenBy: Object.fromEntries(
      Object.entries(lastSeenByRaw).map(([userId, value]) => [userId, toMillis(value)])
    ),
    unreadCountBy: Object.fromEntries(
      Object.entries(unreadCountByRaw).map(([userId, value]) => [
        userId,
        typeof value === 'number' ? value : 0,
      ])
    ),
    isFriend: data.isFriend !== false,
    requestPending: Boolean(data.requestPending),
    requestInitiatorId: data.requestInitiatorId || '',
    requestRecipientId: data.requestRecipientId || '',
  };
};

const isDirectConversationFriend = (data: any) => data.type !== 'group' && data.isFriend !== false;

const getPreviewTextForMessage = (type: ChatMessage['type'], text?: string) => {
  if (type === 'text') return text || '';
  if (type === 'image') return 'Sent a photo';
  if (type === 'video') return 'Sent a video';
  if (type === 'audio') return 'Sent a voice message';
  if (type === 'system') return text || 'Updated the chat';
  return 'Sent a sticker';
};

export const upsertUserProfile = async (user: User) => {
  const existingSnapshot = await getDoc(doc(db, 'users', user.uid));
  const existingData = existingSnapshot.exists()
    ? (existingSnapshot.data() as AppUserProfile)
    : null;
  const isNewProfile = !existingSnapshot.exists();
  const fallbackUsername = getFallbackUsername(user);
  const username = existingData?.username || fallbackUsername;
  const usernameLower = existingData?.usernameLower || username.toLowerCase();
  const usernameChangedAt =
    typeof existingData?.usernameChangedAt === 'number'
      ? existingData.usernameChangedAt
      : toMillis(existingData?.usernameChangedAt);

  const profilePayload: Record<string, any> = {
    uid: user.uid,
    email: user.email || '',
    username,
    usernameLower,
    avatar: user.photoURL || '',
    usernameChangedAt: usernameChangedAt || 0,
    updatedAt: serverTimestamp(),
  };

  if (isNewProfile) {
    profilePayload.bio = '';
    profilePayload.storyHiddenFriendIds = [];
    profilePayload.totalStoriesPosted = 0;
    profilePayload.showActiveStatus = true;
    profilePayload.isActive = false;
    profilePayload.lastActiveAt = 0;
    profilePayload.createdAt = serverTimestamp();
  }

  await setDoc(
    doc(db, 'users', user.uid),
    profilePayload,
    { merge: true }
  );
};

export const getUserProfile = async (userId: string) => {
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) return null;
  return toFoundUser(snapshot);
};

export const USERNAME_CHANGE_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

export const updateUserProfileAvatar = async (userId: string, avatar: string) => {
  await updateDoc(doc(db, 'users', userId), {
    avatar,
    updatedAt: serverTimestamp(),
  });
};

export const updateUserProfileBio = async (userId: string, bio: string) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      bio: bio.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const updateActiveStatusVisibility = async (userId: string, showActiveStatus: boolean) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      showActiveStatus,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const updateUserPresence = async (userId: string, isActive: boolean) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      isActive,
      lastActiveAt: Date.now(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const updateUsernameWithCooldown = async (
  userId: string,
  username: string
) => {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    throw new Error('Name is required.');
  }

  if (trimmedUsername.length < 3) {
    throw new Error('Name must be at least 3 characters.');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    throw new Error('Name can only contain letters, numbers, and underscores.');
  }

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    throw new Error('Profile not found.');
  }

  const data = snapshot.data() as AppUserProfile;
  if ((data.username || '').trim() === trimmedUsername) {
    return {
      updated: false,
      username: trimmedUsername,
      changedAt:
        typeof data.usernameChangedAt === 'number'
          ? data.usernameChangedAt
          : toMillis(data.usernameChangedAt),
    };
  }

  const normalizedUsername = trimmedUsername.toLowerCase();
  const existingUsername = await getDocs(
    query(collection(db, 'users'), where('usernameLower', '==', normalizedUsername), limit(1))
  );
  const conflictingDoc = existingUsername.docs.find((docSnapshot) => docSnapshot.id !== userId);
  if (conflictingDoc) {
    throw new Error('That name is already taken.');
  }

  const changedAt =
    typeof data.usernameChangedAt === 'number'
      ? data.usernameChangedAt
      : toMillis(data.usernameChangedAt);
  const now = Date.now();
  if (changedAt && now - changedAt < USERNAME_CHANGE_COOLDOWN_MS) {
    throw new Error('You can only change your name once every 60 days.');
  }

  await updateDoc(userRef, {
    username: trimmedUsername,
    usernameLower: normalizedUsername,
    usernameChangedAt: now,
    updatedAt: serverTimestamp(),
  });

  return {
    updated: true,
    username: trimmedUsername,
    changedAt: now,
  };
};

export const subscribeToUserProfile = (
  userId: string,
  callback: (user: FoundUser | null) => void
) =>
  onSnapshot(doc(db, 'users', userId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(toFoundUser(snapshot));
  });

export const createProfilePost = async (
  currentUser: User,
  payload: {
    imageUrl: string;
    caption?: string;
  }
) => {
  if (!payload.imageUrl.trim()) {
    throw new Error('Image is required.');
  }

  await addDoc(collection(db, 'profilePosts'), {
    ownerId: currentUser.uid,
    ownerUsername: getFallbackUsername(currentUser),
    ownerAvatar: currentUser.photoURL || '',
    imageUrl: payload.imageUrl.trim(),
    caption: payload.caption?.trim() || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deleteProfilePost = async (postId: string, currentUserId: string) => {
  const postRef = doc(db, 'profilePosts', postId);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();
  if (data.ownerId !== currentUserId) {
    throw new Error('Only the owner can delete this post.');
  }

  await deleteDoc(postRef);
};

export const toggleProfilePostLike = async (currentUser: User, postId: string) => {
  const postSnapshot = await getDoc(doc(db, 'profilePosts', postId));
  if (!postSnapshot.exists()) {
    throw new Error('Post not found.');
  }

  const postData = postSnapshot.data();
  const likeRef = doc(db, 'profilePosts', postId, 'likes', currentUser.uid);
  const likeSnapshot = await getDoc(likeRef);

  if (likeSnapshot.exists()) {
    await deleteDoc(likeRef);
    return false;
  }

  await setDoc(likeRef, {
    userId: currentUser.uid,
    username: getFallbackUsername(currentUser),
    avatar: currentUser.photoURL || '',
    createdAt: serverTimestamp(),
  });

  await createNotificationDoc({
    recipientUserId: postData.ownerId || '',
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'post_like',
    title: 'New like',
    body: `${getFallbackUsername(currentUser)} liked your post.`,
    entityId: postId,
    targetUserId: postData.ownerId || '',
  });

  return true;
};

export const subscribeToProfilePostLikes = (
  postId: string,
  callback: (likes: ProfilePostLike[]) => void
) =>
  onSnapshot(
    query(collection(db, 'profilePosts', postId, 'likes'), limit(100)),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((likeSnapshot) => {
            const data = likeSnapshot.data();

            return {
              userId: data.userId || likeSnapshot.id,
              username: data.username || 'User',
              avatar: data.avatar || '',
              createdAt: toMillis(data.createdAt),
            } satisfies ProfilePostLike;
          })
          .sort((first, second) => first.createdAt - second.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const toggleProfilePostCommentLike = async (
  currentUser: User,
  postId: string,
  commentId: string
) => {
  const commentSnapshot = await getDoc(doc(db, 'profilePosts', postId, 'comments', commentId));
  if (!commentSnapshot.exists()) {
    throw new Error('Comment not found.');
  }

  const commentData = commentSnapshot.data();
  const postSnapshot = await getDoc(doc(db, 'profilePosts', postId));
  const postOwnerId = postSnapshot.exists() ? postSnapshot.data().ownerId || '' : '';
  const likeRef = doc(db, 'profilePosts', postId, 'comments', commentId, 'likes', currentUser.uid);
  const likeSnapshot = await getDoc(likeRef);

  if (likeSnapshot.exists()) {
    await deleteDoc(likeRef);
    return false;
  }

  await setDoc(likeRef, {
    userId: currentUser.uid,
    username: getFallbackUsername(currentUser),
    avatar: currentUser.photoURL || '',
    createdAt: serverTimestamp(),
  });

  await createNotificationDoc({
    recipientUserId: commentData.userId || '',
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'comment_like',
    title: 'Comment liked',
    body: `${getFallbackUsername(currentUser)} liked your comment.`,
    entityId: postId,
    secondaryEntityId: commentId,
    targetUserId: postOwnerId,
  });

  return true;
};

export const addProfilePostComment = async (
  currentUser: User,
  postId: string,
  text: string,
  options?: {
    parentCommentId?: string | null;
    replyToUsername?: string | null;
  }
) => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('Comment is required.');
  }

  const commentRef = await addDoc(collection(db, 'profilePosts', postId, 'comments'), {
    userId: currentUser.uid,
    username: getFallbackUsername(currentUser),
    avatar: currentUser.photoURL || '',
    text: trimmedText,
    parentCommentId: options?.parentCommentId || '',
    replyToUsername: options?.replyToUsername || '',
    createdAt: serverTimestamp(),
  });

  const postSnapshot = await getDoc(doc(db, 'profilePosts', postId));
  const postData = postSnapshot.exists() ? postSnapshot.data() : null;
  const parentCommentId = options?.parentCommentId || '';

  if (postData?.ownerId) {
    await createNotificationDoc({
      recipientUserId: postData.ownerId,
      actorId: currentUser.uid,
      actorUsername: getFallbackUsername(currentUser),
      actorAvatar: currentUser.photoURL || '',
      type: parentCommentId ? 'comment_reply' : 'post_comment',
      title: parentCommentId ? 'New reply' : 'New comment',
      body: parentCommentId
        ? `${getFallbackUsername(currentUser)} replied in your post comments.`
        : `${getFallbackUsername(currentUser)} commented on your post.`,
      entityId: postId,
      secondaryEntityId: commentRef.id,
      targetUserId: postData.ownerId,
    });
  }

  if (parentCommentId) {
    const parentCommentSnapshot = await getDoc(doc(db, 'profilePosts', postId, 'comments', parentCommentId));
    if (parentCommentSnapshot.exists()) {
      const parentCommentData = parentCommentSnapshot.data();
      await createNotificationDoc({
        recipientUserId: parentCommentData.userId || '',
        actorId: currentUser.uid,
        actorUsername: getFallbackUsername(currentUser),
        actorAvatar: currentUser.photoURL || '',
        type: 'comment_reply',
        title: 'New reply',
        body: `${getFallbackUsername(currentUser)} replied to your comment.`,
        entityId: postId,
        secondaryEntityId: commentRef.id,
        targetUserId: postData?.ownerId || '',
      });
    }
  }

  await createMentionNotifications({
    actor: currentUser,
    text: trimmedText,
    type: 'comment_mention',
    title: 'You were mentioned',
    body: `${getFallbackUsername(currentUser)} mentioned you in a comment.`,
    entityId: postId,
    secondaryEntityId: commentRef.id,
    targetUserId: postData?.ownerId || '',
  });
};

export const updateProfilePostComment = async (
  currentUser: User,
  postId: string,
  commentId: string,
  text: string
) => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('Comment is required.');
  }

  await updateDoc(doc(db, 'profilePosts', postId, 'comments', commentId), {
    text: trimmedText,
    editedAt: serverTimestamp(),
  });

  const postSnapshot = await getDoc(doc(db, 'profilePosts', postId));
  const postOwnerId = postSnapshot.exists() ? postSnapshot.data().ownerId || '' : '';

  await createMentionNotifications({
    actor: currentUser,
    text: trimmedText,
    type: 'comment_mention',
    title: 'You were mentioned',
    body: `${getFallbackUsername(currentUser)} mentioned you in a comment.`,
    entityId: postId,
    secondaryEntityId: commentId,
    targetUserId: postOwnerId,
  });
};

export const deleteProfilePostComment = async (
  postId: string,
  commentId: string
) => {
  await deleteDoc(doc(db, 'profilePosts', postId, 'comments', commentId));
};

export const subscribeToProfilePostComments = (
  postId: string,
  callback: (comments: ProfilePostComment[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'profilePosts', postId, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(200)
    ),
    (snapshot) => {
      callback(
        snapshot.docs.map((commentSnapshot) => {
          const data = commentSnapshot.data();

          return {
            id: commentSnapshot.id,
            userId: data.userId || '',
            username: data.username || 'User',
            avatar: data.avatar || '',
            text: data.text || '',
            parentCommentId: data.parentCommentId || '',
            replyToUsername: data.replyToUsername || '',
            createdAt: toMillis(data.createdAt),
            editedAt: toMillis(data.editedAt),
          } satisfies ProfilePostComment;
        })
      );
    },
    () => {
      callback([]);
    }
  );

export const subscribeToProfilePostCommentLikes = (
  postId: string,
  commentId: string,
  callback: (likes: ProfilePostCommentLike[]) => void
) =>
  onSnapshot(
    query(collection(db, 'profilePosts', postId, 'comments', commentId, 'likes'), limit(100)),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((likeSnapshot) => {
            const data = likeSnapshot.data();

            return {
              userId: data.userId || likeSnapshot.id,
              username: data.username || 'User',
              avatar: data.avatar || '',
              createdAt: toMillis(data.createdAt),
            } satisfies ProfilePostCommentLike;
          })
          .sort((first, second) => first.createdAt - second.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const subscribeToProfilePosts = (
  userId: string,
  callback: (posts: ProfilePost[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'profilePosts'),
      where('ownerId', '==', userId),
      limit(60)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((postSnapshot) => {
            const data = postSnapshot.data();

            return {
              id: postSnapshot.id,
              ownerId: data.ownerId || '',
              ownerUsername: data.ownerUsername || 'User',
              ownerAvatar: data.ownerAvatar || '',
              imageUrl: data.imageUrl || '',
              caption: data.caption || '',
              createdAt: toMillis(data.createdAt),
            } satisfies ProfilePost;
          })
          .sort((first, second) => second.createdAt - first.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const subscribeToFriendCount = (
  userId: string,
  callback: (count: number) => void
) =>
  onSnapshot(
    query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', userId)
    ),
    (snapshot) => {
      const count = snapshot.docs.filter((conversationSnapshot) => {
        const data = conversationSnapshot.data();
        const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
        return (
          data.type === 'direct' &&
          isDirectConversationFriend(data) &&
          !hiddenFor.includes(userId)
        );
      }).length;

      callback(count);
    }
  );

export const subscribeToActiveStoryCount = (
  userId: string,
  callback: (count: number) => void
) =>
  onSnapshot(
    query(
      collection(db, 'stories'),
      where('ownerId', '==', userId),
      limit(100)
    ),
    (snapshot) => {
      const now = Date.now();
      const count = snapshot.docs.filter((storySnapshot) => {
        const data = storySnapshot.data();
        const expiresAt =
          typeof data.expiresAt === 'number' ? data.expiresAt : toMillis(data.expiresAt);
        return expiresAt > now;
      }).length;

      callback(count);
    }
  );

export const findUserByUsername = async (username: string) => {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) return null;

  const results = await getDocs(
    query(
      collection(db, 'users'),
      where('usernameLower', '==', normalizedUsername),
      limit(1)
    )
  );

  if (results.empty) return null;
  return toFoundUser(results.docs[0]);
};

export const hasConversation = async (firstUserId: string, secondUserId: string) => {
  const conversationId = getConversationId(firstUserId, secondUserId);
  const snapshot = await getDoc(doc(db, 'conversations', conversationId));
  return snapshot.exists();
};

export const getRelationshipState = async (
  currentUserId: string,
  otherUserId: string
): Promise<RelationshipState> => {
  const conversationId = getConversationId(currentUserId, otherUserId);
  const conversationSnapshot = await getDoc(doc(db, 'conversations', conversationId));

  if (conversationSnapshot.exists()) {
    const data = conversationSnapshot.data();

    if (isDirectConversationFriend(data)) {
      return 'friends';
    }
  }

  const requestSnapshot = await getDoc(
    doc(db, 'friendRequests', getFriendRequestId(currentUserId, otherUserId))
  );

  if (!requestSnapshot.exists()) {
    return 'none';
  }

  const data = requestSnapshot.data();
  if (data.senderId === currentUserId) {
    return 'outgoing-request';
  }

  return 'incoming-request';
};

export const getUserConnectionState = async (
  currentUserId: string,
  otherUserId: string
): Promise<UserConnectionState> => {
  const conversationId = getConversationId(currentUserId, otherUserId);
  const [conversationSnapshot, friendRequestSnapshot, messageRequestSnapshot] = await Promise.all([
    getDoc(doc(db, 'conversations', conversationId)),
    getDoc(doc(db, 'friendRequests', getFriendRequestId(currentUserId, otherUserId))),
    getDoc(doc(db, 'messageRequests', getFriendRequestId(currentUserId, otherUserId))),
  ]);

  let isFriend = false;
  let hasDirectMessage = false;

  if (conversationSnapshot.exists()) {
    const data = conversationSnapshot.data();
    if (data.type === 'direct') {
      hasDirectMessage = true;
      isFriend = isDirectConversationFriend(data);
    }
  }

  const friendRequestData = friendRequestSnapshot.exists() ? friendRequestSnapshot.data() : null;
  const messageRequestData = messageRequestSnapshot.exists() ? messageRequestSnapshot.data() : null;

  return {
    isFriend,
    hasDirectMessage,
    outgoingFriendRequest: Boolean(friendRequestData && friendRequestData.senderId === currentUserId),
    incomingFriendRequest: Boolean(friendRequestData && friendRequestData.receiverId === currentUserId),
    outgoingMessageRequest: Boolean(messageRequestData && messageRequestData.senderId === currentUserId),
    incomingMessageRequest: Boolean(messageRequestData && messageRequestData.receiverId === currentUserId),
  };
};

export const createFriendRequest = async (
  currentUser: User,
  receiver: FoundUser
) => {
  const requestId = getFriendRequestId(currentUser.uid, receiver.id);

  await setDoc(doc(db, 'friendRequests', requestId), {
    senderId: currentUser.uid,
    senderUsername: getFallbackUsername(currentUser),
    senderAvatar: currentUser.photoURL || '',
    receiverId: receiver.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotificationDoc({
    recipientUserId: receiver.id,
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'friend_request',
    title: 'New friend request',
    body: `${getFallbackUsername(currentUser)} sent you a friend request.`,
    entityId: requestId,
  });

  return requestId;
};

export const subscribeToIncomingRequests = (
  currentUserId: string,
  callback: (requests: FriendRequest[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', currentUserId)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((requestSnapshot) => {
            const data = requestSnapshot.data();
            return {
              id: requestSnapshot.id,
              conversationId: getConversationId(data.senderId || '', currentUserId),
              senderId: data.senderId || '',
              senderUsername: data.senderUsername || 'User',
              senderAvatar: data.senderAvatar || '',
              receiverId: data.receiverId || '',
              createdAt: toMillis(data.createdAt),
              lastMessageText: '',
            } satisfies FriendRequest;
          })
          .sort((first, second) => second.createdAt - first.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const createMessageRequest = async (
  currentUser: User,
  receiver: FoundUser,
  initialMessage: string
) => {
  const requestId = getFriendRequestId(currentUser.uid, receiver.id);
  const trimmedMessage = initialMessage.trim();

  if (!trimmedMessage) {
    throw new Error('Message is required.');
  }

  await setDoc(doc(db, 'messageRequests', requestId), {
    senderId: currentUser.uid,
    senderUsername: getFallbackUsername(currentUser),
    senderAvatar: currentUser.photoURL || '',
    receiverId: receiver.id,
    initialMessage: trimmedMessage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotificationDoc({
    recipientUserId: receiver.id,
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'message_request',
    title: 'New message request',
    body: `${getFallbackUsername(currentUser)} sent you a message request.`,
    entityId: requestId,
  });

  return requestId;
};

export const subscribeToIncomingMessageRequests = (
  currentUserId: string,
  callback: (requests: MessageRequest[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'messageRequests'),
      where('receiverId', '==', currentUserId)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((requestSnapshot) => {
            const data = requestSnapshot.data();
            return {
              id: requestSnapshot.id,
              senderId: data.senderId || '',
              senderUsername: data.senderUsername || 'User',
              senderAvatar: data.senderAvatar || '',
              receiverId: data.receiverId || '',
              createdAt: toMillis(data.createdAt),
              initialMessage: data.initialMessage || '',
            } satisfies MessageRequest;
          })
          .sort((first, second) => second.createdAt - first.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const createConversation = async (
  currentUser: User,
  friend: FoundUser
) => {
  const conversationId = getConversationId(currentUser.uid, friend.id);
  const conversationRef = doc(db, 'conversations', conversationId);
  const existingConversation = await getDoc(conversationRef);
  const existingData = existingConversation.exists() ? existingConversation.data() : null;
  const visibleMembers = [currentUser.uid, friend.id];
  const hiddenFor = Array.isArray(existingData?.hiddenFor)
    ? existingData.hiddenFor.filter(
        (userId: unknown): userId is string =>
          typeof userId === 'string' && !visibleMembers.includes(userId)
      )
    : [];

  await setDoc(
    conversationRef,
    {
      type: 'direct',
      title: '',
      avatar: '',
      memberIds: visibleMembers,
      adminIds: visibleMembers,
      hiddenFor,
      createdBy: currentUser.uid,
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: existingData?.lastMessageText || '',
      lastMessageSenderId: existingData?.lastMessageSenderId || '',
      isFriend: true,
      requestPending: false,
      requestInitiatorId: '',
      requestRecipientId: '',
      unreadCountBy: {
        [currentUser.uid]: 0,
        [friend.id]: 0,
      },
    },
    { merge: true }
  );

  return conversationId;
};

export const acceptFriendRequest = async (request: FriendRequest) => {
  const sender = await getUserProfile(request.senderId);
  const receiver = await getUserProfile(request.receiverId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  await createConversation(
    {
      uid: request.receiverId,
      displayName: '',
      email: '',
      photoURL: null,
    } as User,
    sender
  );

  await deleteDoc(doc(db, 'friendRequests', request.id));

  await createNotificationDoc({
    recipientUserId: request.senderId,
    actorId: request.receiverId,
    actorUsername: getDisplayNameFromProfile(receiver),
    actorAvatar: receiver?.avatar || '',
    type: 'friend_accept',
    title: 'Friend request accepted',
    body: `${getDisplayNameFromProfile(receiver)} accepted your friend request.`,
    entityId: request.id,
  });
};

export const declineFriendRequest = async (requestId: string) => {
  await deleteDoc(doc(db, 'friendRequests', requestId));
};

export const acceptMessageRequest = async (request: MessageRequest) => {
  const receiver = await getUserProfile(request.receiverId);
  const conversationId = getConversationId(request.senderId, request.receiverId);
  const conversationRef = doc(db, 'conversations', conversationId);
  const existingConversation = await getDoc(conversationRef);
  const existingData = existingConversation.exists() ? existingConversation.data() : null;
  const visibleMembers = [request.senderId, request.receiverId];
  const hiddenFor = Array.isArray(existingData?.hiddenFor)
    ? existingData.hiddenFor.filter(
        (userId: unknown): userId is string =>
          typeof userId === 'string' && !visibleMembers.includes(userId)
      )
    : [];

  await setDoc(
    conversationRef,
    {
      type: 'direct',
      title: '',
      avatar: '',
      memberIds: visibleMembers,
      adminIds: visibleMembers,
      hiddenFor,
      createdBy: request.senderId,
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: existingData?.lastMessageText || '',
      lastMessageSenderId: existingData?.lastMessageSenderId || '',
      isFriend: false,
      requestPending: false,
      requestInitiatorId: '',
      requestRecipientId: '',
      unreadCountBy: {
        [request.senderId]: 0,
        [request.receiverId]: 0,
      },
    },
    { merge: true }
  );

  await setDoc(doc(db, 'conversations', conversationId, 'messages', request.id), {
    clientMessageId: request.id,
    type: 'text',
    text: request.initialMessage,
    mediaUrl: '',
    durationMs: 0,
    replyTo: null,
    senderId: request.senderId,
    senderUsername: request.senderUsername,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessageText: request.initialMessage,
    lastMessageSenderId: request.senderId,
    updatedAt: serverTimestamp(),
  });

  await deleteDoc(doc(db, 'messageRequests', request.id));

  await createNotificationDoc({
    recipientUserId: request.senderId,
    actorId: request.receiverId,
    actorUsername: getDisplayNameFromProfile(receiver),
    actorAvatar: receiver?.avatar || '',
    type: 'message_request_accept',
    title: 'Message request accepted',
    body: `${getDisplayNameFromProfile(receiver)} accepted your message request.`,
    entityId: request.id,
    secondaryEntityId: conversationId,
  });
};

export const declineMessageRequest = async (requestId: string) => {
  await deleteDoc(doc(db, 'messageRequests', requestId));
};

export const subscribeToFriends = (
  currentUserId: string,
  callback: (friends: FriendSummary[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUserId)
    ),
    async (snapshot) => {
      const friends = await Promise.all(
        snapshot.docs.map(async (conversationSnapshot) => {
          const data = conversationSnapshot.data();
          const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
          if (hiddenFor.includes(currentUserId)) return null;
          if (data.type === 'group') return null;
          if (!isDirectConversationFriend(data)) return null;

          const otherUserId = (data.memberIds || []).find(
            (memberId: string) => memberId !== currentUserId
          );

          if (!otherUserId) return null;

          const otherUser = await getUserProfile(otherUserId);
          if (!otherUser) return null;

          return {
            id: otherUser.id,
            username: otherUser.username,
            nickname:
              data.nicknamesByUserId && typeof data.nicknamesByUserId[otherUser.id] === 'string'
                ? data.nicknamesByUserId[otherUser.id]
                : '',
            avatar: otherUser.avatar,
            showActiveStatus: otherUser.showActiveStatus !== false,
            isActive: Boolean(otherUser.isActive),
            lastActiveAt: otherUser.lastActiveAt || 0,
            conversationId: conversationSnapshot.id,
            lastMessageText: data.lastMessageText || '',
            updatedAt: toMillis(data.updatedAt),
            unreadCount:
              data.unreadCountBy && typeof data.unreadCountBy[currentUserId] === 'number'
                ? data.unreadCountBy[currentUserId]
                : 0,
            lastMessageSenderId: data.lastMessageSenderId || '',
            seenByOtherAt:
              data.lastSeenBy && typeof data.lastSeenBy[otherUserId] !== 'undefined'
                ? toMillis(data.lastSeenBy[otherUserId])
                : 0,
            isFriend: true,
            requestPending: false,
            requestInitiatorId: '',
            requestRecipientId: '',
          };
        })
      );

      callback(
        friends
          .filter(
            (
              friend
            ): friend is Exclude<typeof friend, null> => friend !== null
          )
          .sort((first, second) => second.updatedAt - first.updatedAt)
      );
    }
  );

export const subscribeToDirectMessages = (
  currentUserId: string,
  callback: (friends: FriendSummary[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUserId)
    ),
    async (snapshot) => {
      const conversations = await Promise.all(
        snapshot.docs.map(async (conversationSnapshot) => {
          const data = conversationSnapshot.data();
          const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
          if (hiddenFor.includes(currentUserId)) return null;
          if (data.type === 'group') return null;

          const otherUserId = (data.memberIds || []).find(
            (memberId: string) => memberId !== currentUserId
          );

          if (!otherUserId) return null;

          const otherUser = await getUserProfile(otherUserId);
          if (!otherUser) return null;

          return {
            id: otherUser.id,
            username: otherUser.username,
            nickname:
              data.nicknamesByUserId && typeof data.nicknamesByUserId[otherUser.id] === 'string'
                ? data.nicknamesByUserId[otherUser.id]
                : '',
            avatar: otherUser.avatar,
            showActiveStatus: otherUser.showActiveStatus !== false,
            isActive: Boolean(otherUser.isActive),
            lastActiveAt: otherUser.lastActiveAt || 0,
            conversationId: conversationSnapshot.id,
            lastMessageText: data.lastMessageText || '',
            updatedAt: toMillis(data.updatedAt),
            unreadCount:
              data.unreadCountBy && typeof data.unreadCountBy[currentUserId] === 'number'
                ? data.unreadCountBy[currentUserId]
                : 0,
            lastMessageSenderId: data.lastMessageSenderId || '',
            seenByOtherAt:
              data.lastSeenBy && typeof data.lastSeenBy[otherUserId] !== 'undefined'
                ? toMillis(data.lastSeenBy[otherUserId])
                : 0,
            isFriend: isDirectConversationFriend(data),
            requestPending: Boolean(data.requestPending),
            requestInitiatorId: data.requestInitiatorId || '',
            requestRecipientId: data.requestRecipientId || '',
          } satisfies FriendSummary;
        })
      );

      callback(
        conversations
          .filter(
            (
              conversation
            ): conversation is Exclude<typeof conversation, null> => conversation !== null
          )
          .sort((first, second) => second.updatedAt - first.updatedAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const subscribeToGroups = (
  currentUserId: string,
  callback: (groups: GroupSummary[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUserId)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((conversationSnapshot) => {
            const data = conversationSnapshot.data();
            const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
            if (hiddenFor.includes(currentUserId)) {
              return null;
            }
            if (data.type !== 'group') {
              return null;
            }

            return {
              id: conversationSnapshot.id,
              title: data.title || 'Group',
              avatar: data.avatar || '',
              memberCount: Array.isArray(data.memberIds) ? data.memberIds.length : 0,
              lastMessageText: data.lastMessageText || '',
              updatedAt: toMillis(data.updatedAt),
              unreadCount:
                data.unreadCountBy && typeof data.unreadCountBy[currentUserId] === 'number'
                  ? data.unreadCountBy[currentUserId]
                  : 0,
              lastMessageSenderId: data.lastMessageSenderId || '',
              adminIds: Array.isArray(data.adminIds) ? data.adminIds : [],
            };
          })
          .filter(
            (
              group
            ): group is Exclude<typeof group, null> => group !== null
          )
          .sort((first, second) => second.updatedAt - first.updatedAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const createStory = async (
  currentUser: User,
  payload: {
    type: StoryItem['type'];
    text?: string;
    mediaUrl?: string;
  }
) => {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  await addDoc(collection(db, 'stories'), {
    ownerId: currentUser.uid,
    ownerUsername: getFallbackUsername(currentUser),
    ownerAvatar: currentUser.photoURL || '',
    type: payload.type,
    text: payload.text?.trim() || '',
    mediaUrl: payload.mediaUrl || '',
    views: [],
    likes: [],
    createdAt: serverTimestamp(),
    expiresAt,
  });

  await setDoc(
    doc(db, 'users', currentUser.uid),
    {
      totalStoriesPosted: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribeToVisibleStories = (
  currentUserId: string,
  callback: (stories: StoryFeedEntry[]) => void
) => {
  let unsubscribeStories = () => {};

  const unsubscribeConversations = onSnapshot(
    query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUserId)
    ),
    (conversationSnapshot) => {
      const visibleFriendIds = new Set<string>([currentUserId]);

      conversationSnapshot.docs.forEach((snapshot) => {
        const data = snapshot.data();
        const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
        if (hiddenFor.includes(currentUserId)) {
          return;
        }

        if (data.type !== 'direct') {
          return;
        }

        const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
        const otherUserId = memberIds.find((memberId: string) => memberId !== currentUserId);
        if (otherUserId) {
          visibleFriendIds.add(otherUserId);
        }
      });

      unsubscribeStories();

      unsubscribeStories = onSnapshot(
        query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(200)),
        async (storySnapshot) => {
          const now = Date.now();
          const groupedStories = new Map<string, StoryItem[]>();
          const ownerIds = Array.from(
            new Set(
              storySnapshot.docs
                .map((snapshot) => {
                  const data = snapshot.data();
                  return typeof data.ownerId === 'string' ? data.ownerId : '';
                })
                .filter((ownerId) => ownerId)
            )
          );
          const ownerProfiles = new Map<string, FoundUser | null>(
            await Promise.all(
              ownerIds.map(async (ownerId) => [ownerId, await getUserProfile(ownerId)] as const)
            )
          );

          storySnapshot.docs.forEach((snapshot) => {
            const data = snapshot.data();
            const ownerId = data.ownerId || '';
            const expiresAt =
              typeof data.expiresAt === 'number' ? data.expiresAt : toMillis(data.expiresAt);
            const ownerProfile = ownerProfiles.get(ownerId);
            const hiddenFriendIds = new Set(ownerProfile?.storyHiddenFriendIds || []);

            if (!ownerId || !visibleFriendIds.has(ownerId) || expiresAt <= now) {
              return;
            }

            if (ownerId !== currentUserId && hiddenFriendIds.has(currentUserId)) {
              return;
            }

            const story: StoryItem = {
              id: snapshot.id,
              ownerId,
              ownerUsername: data.ownerUsername || 'User',
              ownerAvatar: data.ownerAvatar || '',
              type: data.type || 'text',
              text: data.text || '',
              mediaUrl: data.mediaUrl || '',
              createdAt: toMillis(data.createdAt),
              expiresAt,
              views: Array.isArray(data.views)
                ? data.views.map((view: any) => ({
                    userId: view.userId || '',
                    username: view.username || 'User',
                    avatar: view.avatar || '',
                    seenAt: typeof view.seenAt === 'number' ? view.seenAt : 0,
                  }))
                : [],
              likes: Array.isArray(data.likes)
                ? data.likes.map((like: any) => ({
                    userId: like.userId || '',
                    username: like.username || 'User',
                    avatar: like.avatar || '',
                    likedAt: typeof like.likedAt === 'number' ? like.likedAt : 0,
                  }))
                : [],
            };

            const existingStories = groupedStories.get(ownerId) || [];
            existingStories.push(story);
            groupedStories.set(ownerId, existingStories);
          });

          const feeds = Array.from(groupedStories.entries())
            .map(([ownerId, stories]) => {
              const orderedStories = [...stories].sort(
                (first, second) => first.createdAt - second.createdAt
              );
              const latestStory = orderedStories[orderedStories.length - 1];

              return {
                ownerId,
                username: latestStory?.ownerUsername || 'User',
                avatar: latestStory?.ownerAvatar || '',
                stories: orderedStories,
                latestAt: latestStory?.createdAt || 0,
                isOwn: ownerId === currentUserId,
              } satisfies StoryFeedEntry;
            })
            .sort((first, second) => {
              if (first.isOwn && !second.isOwn) return -1;
              if (!first.isOwn && second.isOwn) return 1;
              return second.latestAt - first.latestAt;
            });

          callback(feeds);
        }
      );
    }
  );

  return () => {
    unsubscribeStories();
    unsubscribeConversations();
  };
};

export const subscribeToStories = (
  callback: (stories: StoryItem[]) => void
) =>
  onSnapshot(
    query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(200)),
    (snapshot) => {
      const now = Date.now();
      callback(
        snapshot.docs
          .map((storySnapshot) => {
            const data = storySnapshot.data();
            const expiresAt =
              typeof data.expiresAt === 'number' ? data.expiresAt : toMillis(data.expiresAt);

            return {
              id: storySnapshot.id,
              ownerId: data.ownerId || '',
              ownerUsername: data.ownerUsername || 'User',
              ownerAvatar: data.ownerAvatar || '',
              type: data.type || 'text',
              text: data.text || '',
              mediaUrl: data.mediaUrl || '',
              createdAt: toMillis(data.createdAt),
              expiresAt,
              views: Array.isArray(data.views)
                ? data.views.map((view: any) => ({
                    userId: view.userId || '',
                    username: view.username || 'User',
                    avatar: view.avatar || '',
                    seenAt: typeof view.seenAt === 'number' ? view.seenAt : 0,
                  }))
                : [],
              likes: Array.isArray(data.likes)
                ? data.likes.map((like: any) => ({
                    userId: like.userId || '',
                    username: like.username || 'User',
                    avatar: like.avatar || '',
                    likedAt: typeof like.likedAt === 'number' ? like.likedAt : 0,
                  }))
                : [],
            } satisfies StoryItem;
          })
          .filter((story) => story.ownerId && story.expiresAt > now)
      );
    }
  );

export const markStorySeen = async (currentUser: User, storyId: string) => {
  const storyRef = doc(db, 'stories', storyId);
  const snapshot = await getDoc(storyRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();
  if (data.ownerId === currentUser.uid) {
    return;
  }

  const ownerId = typeof data.ownerId === 'string' ? data.ownerId : '';
  if (!ownerId) {
    return;
  }

  const ownerProfile = await getUserProfile(ownerId);
  const hiddenFriendIds = new Set(ownerProfile?.storyHiddenFriendIds || []);
  if (hiddenFriendIds.has(currentUser.uid)) {
    return;
  }

  const existingViews = Array.isArray(data.views) ? data.views : [];
  const hasViewed = existingViews.some((view: any) => view.userId === currentUser.uid);

  if (hasViewed) {
    return;
  }

  await updateDoc(storyRef, {
    views: arrayUnion({
      userId: currentUser.uid,
      username: getFallbackUsername(currentUser),
      avatar: currentUser.photoURL || '',
      seenAt: Date.now(),
    }),
  });
};

export const toggleStoryLike = async (currentUser: User, storyId: string) => {
  const storyRef = doc(db, 'stories', storyId);
  const snapshot = await getDoc(storyRef);

  if (!snapshot.exists()) {
    throw new Error('Story not found.');
  }

  const data = snapshot.data();
  if (data.ownerId === currentUser.uid) {
    return false;
  }

  const existingLikes = Array.isArray(data.likes) ? data.likes : [];
  const existingLike = existingLikes.find((like: any) => like.userId === currentUser.uid);

  if (existingLike) {
    await updateDoc(storyRef, {
      likes: arrayRemove(existingLike),
    });
    return false;
  }

  const like = {
    userId: currentUser.uid,
    username: getFallbackUsername(currentUser),
    avatar: currentUser.photoURL || '',
    likedAt: Date.now(),
  };

  await updateDoc(storyRef, {
    likes: arrayUnion(like),
  });

  await createNotificationDoc({
    recipientUserId: data.ownerId || '',
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'story_like',
    title: 'Story liked',
    body: `${getFallbackUsername(currentUser)} liked your story.`,
    entityId: storyId,
  });

  return true;
};

export const deleteStory = async (storyId: string, currentUserId: string) => {
  const storyRef = doc(db, 'stories', storyId);
  const snapshot = await getDoc(storyRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();
  if (data.ownerId !== currentUserId) {
    throw new Error('Only the owner can delete this story');
  }

  await deleteDoc(storyRef);
};

export const cleanupExpiredStoriesForUser = async (userId: string) => {
  const snapshot = await getDocs(
    query(collection(db, 'stories'), where('ownerId', '==', userId), limit(100))
  );

  const now = Date.now();
  await Promise.all(
    snapshot.docs.map(async (storySnapshot) => {
      const data = storySnapshot.data();
      const expiresAt =
        typeof data.expiresAt === 'number' ? data.expiresAt : toMillis(data.expiresAt);

      if (expiresAt > 0 && expiresAt <= now) {
        await deleteDoc(storySnapshot.ref);
      }
    })
  );
};

export const subscribeToMessages = (
  conversationId: string,
  currentUserId: string,
  callback: (messages: ChatMessage[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((messageSnapshot) => {
            const data = messageSnapshot.data();
            const deletedFor = Array.isArray(data.deletedFor) ? data.deletedFor : [];

            if (deletedFor.includes(currentUserId)) {
              return null;
            }

            return {
              id: messageSnapshot.id,
              clientMessageId: data.clientMessageId || messageSnapshot.id,
              type: data.type || 'text',
              text: data.text || '',
              mediaUrl: data.mediaUrl || '',
              durationMs: data.durationMs || 0,
              senderId: data.senderId || '',
              senderUsername: data.senderUsername || '',
              createdAt: toMillis(data.createdAt) || (typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : 0),
              clientCreatedAt: typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : 0,
              deletedForAll: Boolean(data.deletedForAll),
              deletedFor,
              editedAt: toMillis(data.editedAt),
              reactions: Array.isArray(data.reactions)
                ? data.reactions
                    .map((reaction: any) => ({
                      userId: reaction.userId || '',
                      username: reaction.username || 'User',
                      avatar: reaction.avatar || '',
                      emoji: reaction.emoji || '',
                      reactedAt:
                        typeof reaction.reactedAt === 'number'
                          ? reaction.reactedAt
                          : toMillis(reaction.reactedAt),
                    }))
                    .filter((reaction: any) => reaction.userId && reaction.emoji)
                : [],
              status: 'sent' as const,
              replyTo:
                data.replyTo && typeof data.replyTo === 'object'
                  ? {
                      type: 'story' as const,
                      ownerId: data.replyTo.ownerId || '',
                      ownerUsername: data.replyTo.ownerUsername || 'User',
                      storyType: data.replyTo.storyType || 'text',
                      storyText: data.replyTo.storyText || '',
                      storyMediaUrl: data.replyTo.storyMediaUrl || '',
                    }
                  : undefined,
            };
          })
          .filter((message): message is Exclude<typeof message, null> => message !== null)
      );
    }
  );

export const conversationExists = async (conversationId: string) => {
  const snapshot = await getDoc(doc(db, 'conversations', conversationId));
  return snapshot.exists();
};

export const getConversationInfo = async (conversationId: string) => {
  const snapshot = await getDoc(doc(db, 'conversations', conversationId));
  if (!snapshot.exists()) return null;
  return toConversationInfo(snapshot);
};

export const subscribeToConversationInfo = (
  conversationId: string,
  callback: (conversation: ConversationInfo | null) => void
) =>
  onSnapshot(doc(db, 'conversations', conversationId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(toConversationInfo(snapshot));
  });

export const subscribeToConversationMembers = (
  conversationId: string,
  callback: (members: FoundUser[]) => void
) =>
  onSnapshot(doc(db, 'conversations', conversationId), async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.data();
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
    const members = await Promise.all(memberIds.map((memberId) => getUserProfile(memberId)));

    callback(
      members.filter(
        (member): member is Exclude<typeof member, null> => member !== null
      )
    );
  });

const ensureDirectConversationExists = async (
  currentUserId: string,
  otherUserId: string
) => {
  const conversationId = getConversationId(currentUserId, otherUserId);
  const conversationRef = doc(db, 'conversations', conversationId);
  const existingConversation = await getDoc(conversationRef);

  if (!existingConversation.exists()) {
    throw new Error('Conversation does not exist');
  }

  return { conversationId, conversationRef };
};

const getOrCreateDirectConversation = async (
  currentUser: User,
  otherUserId: string
) => {
  const conversationId = getConversationId(currentUser.uid, otherUserId);
  const conversationRef = doc(db, 'conversations', conversationId);
  const existingConversation = await getDoc(conversationRef);

  if (!existingConversation.exists()) {
    await setDoc(conversationRef, {
      type: 'direct',
      title: '',
      avatar: '',
      memberIds: [currentUser.uid, otherUserId],
      adminIds: [currentUser.uid, otherUserId],
      hiddenFor: [],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: '',
      lastMessageSenderId: '',
      isFriend: false,
      requestPending: true,
      requestInitiatorId: currentUser.uid,
      requestRecipientId: otherUserId,
      unreadCountBy: {
        [currentUser.uid]: 0,
        [otherUserId]: 0,
      },
    });
  }

  return { conversationId, conversationRef };
};

const ensureConversationMembership = async (
  currentUserId: string,
  conversationId: string
) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) {
    throw new Error('Conversation does not exist');
  }

  const data = snapshot.data();
  const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];

  if (!memberIds.includes(currentUserId)) {
    throw new Error('User is not part of this conversation');
  }

  return { conversationRef, conversation: data };
};

const addSystemConversationMessage = async (
  conversationId: string,
  actor: {
    uid: string;
    username: string;
  },
  text: string
) => {
  if (!text.trim()) return;

  await addConversationMessage(
    {
      uid: actor.uid,
      displayName: actor.username,
      email: '',
    } as User,
    conversationId,
    {
      clientCreatedAt: Date.now(),
      type: 'system',
      text: text.trim(),
    }
  );
};

const addConversationMessage = async (
  currentUser: User,
  conversationId: string,
  payload: {
    clientMessageId?: string;
    clientCreatedAt?: number;
    type: ChatMessage['type'];
    text: string;
    mediaUrl?: string;
    durationMs?: number;
    replyTo?: ChatMessage['replyTo'];
  }
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    currentUser.uid,
    conversationId
  );

  const lastMessageText = getPreviewTextForMessage(payload.type, payload.text);
  const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds : [];
  const unreadCountByUpdate: Record<string, any> = {
    [`unreadCountBy.${currentUser.uid}`]: 0,
  };

  memberIds
    .filter((memberId: string) => memberId && memberId !== currentUser.uid)
    .forEach((memberId: string) => {
      unreadCountByUpdate[`unreadCountBy.${memberId}`] = increment(1);
    });

  await updateDoc(conversationRef, {
    updatedAt: serverTimestamp(),
    lastMessageText,
    lastMessageSenderId: currentUser.uid,
    hiddenFor: arrayRemove(currentUser.uid),
    [`typingBy.${currentUser.uid}`]: false,
    ...unreadCountByUpdate,
  });

  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  const messageRef = payload.clientMessageId
    ? doc(messagesCollection, payload.clientMessageId)
    : doc(messagesCollection);

  await setDoc(messageRef, {
    clientMessageId: payload.clientMessageId || messageRef.id,
    clientCreatedAt: payload.clientCreatedAt || Date.now(),
    type: payload.type,
    text: payload.text,
    mediaUrl: payload.mediaUrl || '',
    durationMs: payload.durationMs || 0,
    replyTo: payload.replyTo || null,
    senderId: currentUser.uid,
    senderUsername: getFallbackUsername(currentUser),
    createdAt: serverTimestamp(),
  });
};

export const sendMessage = async (
  currentUser: User,
  otherUserId: string,
  text: string,
  replyTo?: ChatMessage['replyTo']
) => {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  const { conversationId } = await getOrCreateDirectConversation(
    currentUser,
    otherUserId
  );

  await addConversationMessage(currentUser, conversationId, {
    type: 'text',
    text: trimmedText,
    replyTo,
  });
};

export const sendMediaMessage = async (
  currentUser: User,
  otherUserId: string,
  options: {
    type: 'image' | 'video' | 'audio';
    mediaUrl: string;
    durationMs?: number;
  }
) => {
  if (!options.mediaUrl) return;

  const { conversationId } = await getOrCreateDirectConversation(
    currentUser,
    otherUserId
  );

  await addConversationMessage(currentUser, conversationId, {
    type: options.type,
    text: '',
    mediaUrl: options.mediaUrl,
    durationMs: options.durationMs || 0,
  });
};

export const sendStickerMessage = async (
  currentUser: User,
  otherUserId: string,
  sticker: string
) => {
  if (!sticker.trim()) return;

  const { conversationId } = await getOrCreateDirectConversation(
    currentUser,
    otherUserId
  );

  await addConversationMessage(currentUser, conversationId, {
    type: 'sticker',
    text: sticker,
  });
};

export const updateStoryPrivacy = async (userId: string, hiddenFriendIds: string[]) => {
  await updateDoc(doc(db, 'users', userId), {
    storyHiddenFriendIds: hiddenFriendIds,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: AppNotification[]) => void
) =>
  onSnapshot(
    query(
      collection(db, 'notifications'),
      where('recipientUserId', '==', userId),
      limit(100)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((notificationSnapshot) => {
            const data = notificationSnapshot.data();
            return {
              id: notificationSnapshot.id,
              recipientUserId: data.recipientUserId || '',
              actorId: data.actorId || '',
              actorUsername: data.actorUsername || 'Someone',
              actorAvatar: data.actorAvatar || '',
              type: data.type || 'post_comment',
              title: data.title || '',
              body: data.body || '',
              entityId: data.entityId || '',
              secondaryEntityId: data.secondaryEntityId || '',
              targetUserId: data.targetUserId || '',
              isRead: Boolean(data.isRead),
              createdAt: toMillis(data.createdAt),
            } satisfies AppNotification;
          })
          .sort((first, second) => second.createdAt - first.createdAt)
      );
    },
    () => {
      callback([]);
    }
  );

export const subscribeToUnreadNotificationCount = (
  userId: string,
  callback: (count: number) => void
) =>
  onSnapshot(
    query(collection(db, 'notifications'), where('recipientUserId', '==', userId), limit(100)),
    (snapshot) => {
      callback(snapshot.docs.filter((docSnapshot) => !docSnapshot.data().isRead).length);
    },
    () => {
      callback(0);
    }
  );

export const markNotificationRead = async (notificationId: string, userId: string) => {
  const notificationRef = doc(db, 'notifications', notificationId);
  const snapshot = await getDoc(notificationRef);
  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();
  if (data.recipientUserId !== userId) {
    throw new Error('Not allowed.');
  }

  await updateDoc(notificationRef, {
    isRead: true,
  });
};

export const markAllNotificationsRead = async (userId: string) => {
  const snapshot = await getDocs(
    query(collection(db, 'notifications'), where('recipientUserId', '==', userId), limit(100))
  );

  await Promise.all(
    snapshot.docs
      .filter((docSnapshot) => !docSnapshot.data().isRead)
      .map((docSnapshot) =>
        updateDoc(doc(db, 'notifications', docSnapshot.id), {
          isRead: true,
        })
      )
  );
};

export const notifyStoryReply = async (
  currentUser: User,
  ownerId: string,
  storyId: string,
  message: string
) => {
  await createNotificationDoc({
    recipientUserId: ownerId,
    actorId: currentUser.uid,
    actorUsername: getFallbackUsername(currentUser),
    actorAvatar: currentUser.photoURL || '',
    type: 'story_reply',
    title: 'New story reply',
    body: `${getFallbackUsername(currentUser)} replied to your story: ${message.trim().slice(0, 80)}`,
    entityId: storyId,
  });
};

export const sendConversationMessage = async (
  currentUser: User,
  conversationId: string,
  text: string,
  clientMessageId?: string,
  replyTo?: ChatMessage['replyTo']
) => {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  await addConversationMessage(currentUser, conversationId, {
    clientMessageId,
    clientCreatedAt: Date.now(),
    type: 'text',
    text: trimmedText,
    replyTo,
  });
};

export const sendConversationMediaMessage = async (
  currentUser: User,
  conversationId: string,
  options: {
    type: 'image' | 'video' | 'audio';
    mediaUrl: string;
    durationMs?: number;
  }
) => {
  if (!options.mediaUrl) return;

  await addConversationMessage(currentUser, conversationId, {
    clientCreatedAt: Date.now(),
    type: options.type,
    text: '',
    mediaUrl: options.mediaUrl,
    durationMs: options.durationMs || 0,
  });
};

export const sendConversationStickerMessage = async (
  currentUser: User,
  conversationId: string,
  sticker: string,
  clientMessageId?: string
) => {
  if (!sticker.trim()) return;

  await addConversationMessage(currentUser, conversationId, {
    clientMessageId,
    clientCreatedAt: Date.now(),
    type: 'sticker',
    text: sticker,
  });
};

export const updateConversationTyping = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
) => {
  const { conversationRef } = await ensureConversationMembership(userId, conversationId);

  await updateDoc(conversationRef, {
    [`typingBy.${userId}`]: isTyping,
  });
};

export const markConversationSeen = async (
  conversationId: string,
  userId: string
) => {
  const { conversationRef } = await ensureConversationMembership(userId, conversationId);

  await updateDoc(conversationRef, {
    [`lastSeenBy.${userId}`]: serverTimestamp(),
    [`typingBy.${userId}`]: false,
    [`unreadCountBy.${userId}`]: 0,
  });
};

export const createGroupConversation = async (
  currentUser: User,
  options: {
    name: string;
    memberIds: string[];
  }
) => {
  const memberIds = Array.from(new Set([currentUser.uid, ...options.memberIds]));
  const unreadCountBy = Object.fromEntries(memberIds.map((memberId) => [memberId, 0]));

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    type: 'group',
    title: options.name.trim(),
    avatar: '',
    memberIds,
    adminIds: [currentUser.uid],
    hiddenFor: [],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageText: '',
    lastMessageSenderId: '',
    unreadCountBy,
  });

  return conversationRef.id;
};

export const addMembersToGroup = async (
  conversationId: string,
  adminUserId: string,
  memberIds: string[]
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    adminUserId,
    conversationId
  );

  const adminIds = Array.isArray(conversation.adminIds) ? conversation.adminIds : [];
  if (!adminIds.includes(adminUserId)) {
    throw new Error('Only the admin can add members');
  }

  await updateDoc(conversationRef, {
    memberIds: arrayUnion(...memberIds),
    hiddenFor: arrayRemove(...memberIds),
    updatedAt: serverTimestamp(),
  });
};

export const removeMemberFromGroup = async (
  conversationId: string,
  adminUserId: string,
  memberId: string
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    adminUserId,
    conversationId
  );

  const adminIds = Array.isArray(conversation.adminIds) ? conversation.adminIds : [];
  if (!adminIds.includes(adminUserId)) {
    throw new Error('Only the admin can remove members');
  }

  const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds : [];
  if (!memberIds.includes(memberId)) return;

  await updateDoc(conversationRef, {
    memberIds: memberIds.filter((value: string) => value !== memberId),
    hiddenFor: arrayUnion(memberId),
    updatedAt: serverTimestamp(),
  });
};

export const leaveGroupConversation = async (
  conversationId: string,
  userId: string
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    userId,
    conversationId
  );

  if (conversation.type !== 'group') {
    throw new Error('Only group conversations can be left');
  }

  const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds : [];
  const adminIds = Array.isArray(conversation.adminIds) ? conversation.adminIds : [];

  await updateDoc(conversationRef, {
    memberIds: memberIds.filter((value: string) => value !== userId),
    adminIds: adminIds.filter((value: string) => value !== userId),
    hiddenFor: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
};

export const hideConversationForUser = async (
  conversationId: string,
  userId: string
) => {
  const { conversationRef } = await ensureConversationMembership(userId, conversationId);

  await updateDoc(conversationRef, {
    hiddenFor: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
};

export const updateConversationNickname = async (
  conversationId: string,
  currentUserId: string,
  targetUserId: string,
  nickname: string
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    currentUserId,
    conversationId
  );

  const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds : [];
  if (!memberIds.includes(targetUserId)) {
    throw new Error('User is not part of this conversation');
  }

  const trimmedNickname = nickname.trim();
  const currentNickname =
    conversation.nicknamesByUserId && typeof conversation.nicknamesByUserId === 'object'
      ? conversation.nicknamesByUserId[targetUserId] || ''
      : '';

  if (currentNickname === trimmedNickname) {
    return;
  }

  await updateDoc(conversationRef, {
    [`nicknamesByUserId.${targetUserId}`]: trimmedNickname,
    updatedAt: serverTimestamp(),
  });

  const [actorProfile, targetProfile] = await Promise.all([
    getUserProfile(currentUserId),
    getUserProfile(targetUserId),
  ]);
  const actorName = actorProfile?.username || 'Someone';
  const targetName = targetProfile?.username || 'Someone';
  const systemText = trimmedNickname
    ? `${actorName} changed ${targetName}'s nickname to ${trimmedNickname}`
    : `${actorName} cleared ${targetName}'s nickname`;

  await addSystemConversationMessage(conversationId, {
    uid: currentUserId,
    username: actorName,
  }, systemText);
};

export const updateGroupConversationDetails = async (
  conversationId: string,
  currentUserId: string,
  updates: {
    title?: string;
    avatar?: string;
  }
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    currentUserId,
    conversationId
  );

  if (conversation.type !== 'group') {
    throw new Error('Only groups can be updated here');
  }

  const payload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };
  const systemMessages: string[] = [];
  const actorProfile = await getUserProfile(currentUserId);
  const actorName = actorProfile?.username || 'Someone';

  if (typeof updates.title === 'string') {
    const title = updates.title.trim();
    if (!title) {
      throw new Error('Group name is required');
    }

    if (title !== (conversation.title || '')) {
      payload.title = title;
      systemMessages.push(`${actorName} changed the group name to ${title}`);
    }
  }

  if (typeof updates.avatar === 'string' && updates.avatar !== (conversation.avatar || '')) {
    payload.avatar = updates.avatar;
    systemMessages.push(`${actorName} updated the group photo`);
  }

  if (Object.keys(payload).length === 1) {
    return;
  }

  await updateDoc(conversationRef, payload);

  await Promise.all(
    systemMessages.map((message) =>
      addSystemConversationMessage(conversationId, { uid: currentUserId, username: actorName }, message)
    )
  );
};

export const unfriendConversation = async (
  conversationId: string,
  currentUserId: string
) => {
  const { conversationRef, conversation } = await ensureConversationMembership(
    currentUserId,
    conversationId
  );

  if (conversation.type !== 'direct') {
    throw new Error('Only direct conversations can be unfriended');
  }

  const messagesSnapshot = await getDocs(
    collection(db, 'conversations', conversationId, 'messages')
  );

  await Promise.all(messagesSnapshot.docs.map((messageSnapshot) => deleteDoc(messageSnapshot.ref)));
  await deleteDoc(conversationRef);
};

export const deleteMessageForSelf = async (
  conversationId: string,
  messageId: string,
  userId: string
) => {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
    deletedFor: arrayUnion(userId),
  });
};

export const deleteMessageForEveryone = async (
  conversationId: string,
  messageId: string,
  userId: string
) => {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snapshot = await getDoc(messageRef);

  if (!snapshot.exists()) {
    throw new Error('Message not found');
  }

  const data = snapshot.data();
  if (data.senderId !== userId) {
    throw new Error('Only the sender can delete for everyone');
  }

  await updateDoc(messageRef, {
    deletedForAll: true,
    text: '',
    mediaUrl: '',
  });
};

export const updateConversationMessage = async (
  conversationId: string,
  messageId: string,
  userId: string,
  text: string
) => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('Message text is required');
  }

  const { conversationRef } = await ensureConversationMembership(userId, conversationId);
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const messageSnapshot = await getDoc(messageRef);

  if (!messageSnapshot.exists()) {
    throw new Error('Message not found');
  }

  const messageData = messageSnapshot.data();
  if (messageData.senderId !== userId) {
    throw new Error('Only the sender can edit this message');
  }

  if (messageData.deletedForAll) {
    throw new Error('Cannot edit a deleted message');
  }

  if ((messageData.type || 'text') !== 'text') {
    throw new Error('Only text messages can be edited');
  }

  await updateDoc(messageRef, {
    text: trimmedText,
    editedAt: serverTimestamp(),
  });

  const conversationSnapshot = await getDoc(conversationRef);
  if (!conversationSnapshot.exists()) {
    return;
  }

  const conversationData = conversationSnapshot.data();
  if (
    conversationData.lastMessageSenderId === userId &&
    (conversationData.lastMessageText || '') === (messageData.text || '')
  ) {
    await updateDoc(conversationRef, {
      lastMessageText: trimmedText,
      updatedAt: serverTimestamp(),
    });
  }
};

export const toggleConversationMessageReaction = async (
  currentUser: User,
  conversationId: string,
  message: ChatMessage,
  emoji: string
) => {
  if (!emoji.trim()) {
    return;
  }

  const { conversationRef, conversation } = await ensureConversationMembership(
    currentUser.uid,
    conversationId
  );
  const messageRef = doc(db, 'conversations', conversationId, 'messages', message.id);
  const snapshot = await getDoc(messageRef);

  if (!snapshot.exists()) {
    throw new Error('Message not found');
  }

  const data = snapshot.data();
  if (data.deletedForAll) {
    throw new Error('Cannot react to a deleted message');
  }

  const existingReactions = Array.isArray(data.reactions) ? data.reactions : [];
  const filteredReactions = existingReactions.filter((reaction: any) => reaction.userId !== currentUser.uid);
  const currentReaction = existingReactions.find((reaction: any) => reaction.userId === currentUser.uid);
  const isRemovingSameReaction = currentReaction?.emoji === emoji;

  const nextReactions = isRemovingSameReaction
    ? filteredReactions
    : [
        ...filteredReactions,
        {
          userId: currentUser.uid,
          username: getFallbackUsername(currentUser),
          avatar: currentUser.photoURL || '',
          emoji,
          reactedAt: Date.now(),
        },
      ];

  await updateDoc(messageRef, {
    reactions: nextReactions,
  });

  const targetPreview =
    emoji === '❤️'
      ? 'Reacted ❤️ to a message'
      : `Reacted ${emoji} to a message`;

  await updateDoc(conversationRef, {
    lastMessageText: targetPreview,
    lastMessageSenderId: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  if (message.senderId && message.senderId !== currentUser.uid) {
    const actorName = getFallbackUsername(currentUser);
    await createNotificationDoc({
      recipientUserId: message.senderId,
      actorId: currentUser.uid,
      actorUsername: actorName,
      actorAvatar: currentUser.photoURL || '',
      type: 'message_reaction',
      title: 'Message reaction',
      body:
        emoji === '❤️'
          ? `${actorName} liked your message.`
          : `${actorName} reacted ${emoji} to your message.`,
      entityId: message.id,
      secondaryEntityId: conversationId,
      targetUserId: message.senderId,
    });
  }

  return nextReactions;
};
