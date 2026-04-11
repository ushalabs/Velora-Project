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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@firebase/firestore';
import type { User } from '@firebase/auth';
import { firebaseApp } from '@/lib/firebase';

export const db = getFirestore(firebaseApp);

export type AppUserProfile = {
  uid: string;
  email: string;
  username: string;
  usernameLower: string;
  avatar: string;
  expoPushTokens?: string[];
};

export type FoundUser = {
  id: string;
  username: string;
  avatar?: string;
};

export type ConversationInfo = {
  id: string;
  type: 'direct' | 'group';
  title: string;
  avatar?: string;
  memberIds: string[];
  adminIds: string[];
  hiddenFor?: string[];
  createdBy?: string;
  updatedAt: number;
};

export type FriendSummary = {
  id: string;
  username: string;
  avatar?: string;
  conversationId: string;
  lastMessageText: string;
  updatedAt: number;
};

export type GroupSummary = {
  id: string;
  title: string;
  avatar?: string;
  memberCount: number;
  lastMessageText: string;
  updatedAt: number;
  adminIds: string[];
};

export type ChatMessage = {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker';
  text: string;
  mediaUrl?: string;
  durationMs?: number;
  senderId: string;
  senderUsername?: string;
  createdAt: number;
  deletedForAll?: boolean;
};

export type FriendRequest = {
  id: string;
  senderId: string;
  senderUsername: string;
  senderAvatar?: string;
  receiverId: string;
  createdAt: number;
};

export type RelationshipState =
  | 'none'
  | 'friends'
  | 'outgoing-request'
  | 'incoming-request';

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

const toFoundUser = (snapshot: any): FoundUser => {
  const data = snapshot.data() as AppUserProfile;
  return {
    id: snapshot.id,
    username: data.username,
    avatar: data.avatar,
  };
};

const toConversationInfo = (snapshot: any): ConversationInfo => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    type: data.type === 'group' ? 'group' : 'direct',
    title: data.title || 'Conversation',
    avatar: data.avatar || '',
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
    adminIds: Array.isArray(data.adminIds) ? data.adminIds : [],
    hiddenFor: Array.isArray(data.hiddenFor) ? data.hiddenFor : [],
    createdBy: data.createdBy || '',
    updatedAt: toMillis(data.updatedAt),
  };
};

const getPreviewTextForMessage = (type: ChatMessage['type'], text?: string) => {
  if (type === 'text') return text || '';
  if (type === 'image') return 'Sent a photo';
  if (type === 'video') return 'Sent a video';
  if (type === 'audio') return 'Sent a voice message';
  return 'Sent a sticker';
};

export const upsertUserProfile = async (user: User) => {
  const username = getFallbackUsername(user);

  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || '',
      username,
      usernameLower: username.toLowerCase(),
      avatar: user.photoURL || '',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getUserProfile = async (userId: string) => {
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) return null;
  return toFoundUser(snapshot);
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
  if (await hasConversation(currentUserId, otherUserId)) {
    return 'friends';
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
              senderId: data.senderId || '',
              senderUsername: data.senderUsername || 'User',
              senderAvatar: data.senderAvatar || '',
              receiverId: data.receiverId || '',
              createdAt: toMillis(data.createdAt),
            };
          })
          .sort((first, second) => second.createdAt - first.createdAt)
      );
    }
  );

export const createConversation = async (
  currentUser: User,
  friend: FoundUser
) => {
  const conversationId = getConversationId(currentUser.uid, friend.id);

  await setDoc(
    doc(db, 'conversations', conversationId),
    {
      type: 'direct',
      title: '',
      avatar: '',
      memberIds: [currentUser.uid, friend.id],
      adminIds: [currentUser.uid, friend.id],
      hiddenFor: [],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: '',
      lastMessageSenderId: '',
    },
    { merge: true }
  );

  return conversationId;
};

export const acceptFriendRequest = async (request: FriendRequest) => {
  const sender = await getUserProfile(request.senderId);
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
};

export const declineFriendRequest = async (requestId: string) => {
  await deleteDoc(doc(db, 'friendRequests', requestId));
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

          const otherUserId = (data.memberIds || []).find(
            (memberId: string) => memberId !== currentUserId
          );

          if (!otherUserId) return null;

          const otherUser = await getUserProfile(otherUserId);
          if (!otherUser) return null;

          return {
            id: otherUser.id,
            username: otherUser.username,
            avatar: otherUser.avatar,
            conversationId: conversationSnapshot.id,
            lastMessageText: data.lastMessageText || '',
            updatedAt: toMillis(data.updatedAt),
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
    }
  );

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
              type: data.type || 'text',
              text: data.text || '',
              mediaUrl: data.mediaUrl || '',
              durationMs: data.durationMs || 0,
              senderId: data.senderId || '',
              senderUsername: data.senderUsername || '',
              createdAt: toMillis(data.createdAt),
              deletedForAll: Boolean(data.deletedForAll),
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

const addConversationMessage = async (
  currentUser: User,
  conversationId: string,
  payload: {
    type: ChatMessage['type'];
    text: string;
    mediaUrl?: string;
    durationMs?: number;
  }
) => {
  const { conversationRef } = await ensureConversationMembership(
    currentUser.uid,
    conversationId
  );

  const lastMessageText = getPreviewTextForMessage(payload.type, payload.text);

  await setDoc(
    conversationRef,
    {
      updatedAt: serverTimestamp(),
      lastMessageText,
      lastMessageSenderId: currentUser.uid,
      hiddenFor: arrayRemove(currentUser.uid),
    },
    { merge: true }
  );

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    type: payload.type,
    text: payload.text,
    mediaUrl: payload.mediaUrl || '',
    durationMs: payload.durationMs || 0,
    senderId: currentUser.uid,
    senderUsername: getFallbackUsername(currentUser),
    createdAt: serverTimestamp(),
  });
};

export const sendMessage = async (
  currentUser: User,
  otherUserId: string,
  text: string
) => {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  const { conversationId } = await ensureDirectConversationExists(
    currentUser.uid,
    otherUserId
  );

  await addConversationMessage(currentUser, conversationId, {
    type: 'text',
    text: trimmedText,
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

  const { conversationId } = await ensureDirectConversationExists(
    currentUser.uid,
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

  const { conversationId } = await ensureDirectConversationExists(
    currentUser.uid,
    otherUserId
  );

  await addConversationMessage(currentUser, conversationId, {
    type: 'sticker',
    text: sticker,
  });
};

export const sendConversationMessage = async (
  currentUser: User,
  conversationId: string,
  text: string
) => {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  await addConversationMessage(currentUser, conversationId, {
    type: 'text',
    text: trimmedText,
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
    type: options.type,
    text: '',
    mediaUrl: options.mediaUrl,
    durationMs: options.durationMs || 0,
  });
};

export const sendConversationStickerMessage = async (
  currentUser: User,
  conversationId: string,
  sticker: string
) => {
  if (!sticker.trim()) return;

  await addConversationMessage(currentUser, conversationId, {
    type: 'sticker',
    text: sticker,
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
