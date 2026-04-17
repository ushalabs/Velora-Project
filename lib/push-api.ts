import { auth } from '@/lib/firebase';

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'sticker';

const PUSH_API_URL = process.env.EXPO_PUBLIC_PUSH_API_URL?.trim() || '';

const getPreviewText = (type: MessageType, text: string) => {
  if (type === 'text') return text.trim();
  if (type === 'image') return 'Sent a photo';
  if (type === 'video') return 'Sent a video';
  if (type === 'audio') return 'Sent a voice message';
  return text.trim() || 'Sent a sticker';
};

export const sendMessagePushNotification = async (options: {
  conversationId: string;
  senderName: string;
  messageType: MessageType;
  text?: string;
}) => {
  if (!PUSH_API_URL) {
    return;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  const idToken = await currentUser.getIdToken();

  await fetch(`${PUSH_API_URL.replace(/\/$/, '')}/api/send-message-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      conversationId: options.conversationId,
      senderName: options.senderName,
      previewText: getPreviewText(options.messageType, options.text || ''),
    }),
  });
};

export const sendUserPushNotification = async (options: {
  recipientUserIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) => {
  if (!PUSH_API_URL || options.recipientUserIds.length === 0) {
    return;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  const idToken = await currentUser.getIdToken();

  await fetch(`${PUSH_API_URL.replace(/\/$/, '')}/api/send-social-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      recipientUserIds: options.recipientUserIds,
      title: options.title,
      body: options.body,
      data: options.data || {},
    }),
  });
};
