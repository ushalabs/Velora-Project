import { router } from 'expo-router';

type NotificationPayload = {
  type?: string;
  actorId?: string;
  entityId?: string;
  secondaryEntityId?: string;
  targetUserId?: string;
};

const toStringValue = (value: unknown) => (typeof value === 'string' ? value : '');

export const navigateFromNotificationPayload = (
  rawPayload: unknown,
  currentUserId?: string | null
) => {
  const payload = (rawPayload || {}) as NotificationPayload;
  const type = toStringValue(payload.type);
  const actorId = toStringValue(payload.actorId);
  const entityId = toStringValue(payload.entityId);
  const secondaryEntityId = toStringValue(payload.secondaryEntityId);
  const targetUserId = toStringValue(payload.targetUserId);

  if (
    type === 'friend_request' ||
    type === 'friend_accept' ||
    type === 'message_request'
  ) {
    router.push('/(tabs)/friends');
    return;
  }

  if (type === 'message_request_accept') {
    if (secondaryEntityId) {
      router.push({ pathname: '/chat/[id]', params: { id: secondaryEntityId } });
      return;
    }
    router.push('/(tabs)/friends');
    return;
  }

  if (type === 'message_reaction') {
    if (secondaryEntityId) {
      router.push({ pathname: '/chat/[id]', params: { id: secondaryEntityId } });
      return;
    }
    router.push('/(tabs)/friends');
    return;
  }

  if (type === 'story_reply' || type === 'story_like') {
    router.push('/(tabs)/stories');
    return;
  }

  if (
    type === 'post_like' ||
    type === 'post_comment' ||
    type === 'comment_like' ||
    type === 'comment_reply' ||
    type === 'comment_mention'
  ) {
    const ownerId = targetUserId || currentUserId || '';
    if (!ownerId) {
      return;
    }

    if (ownerId === currentUserId) {
      router.push({
        pathname: '/(tabs)/profile',
        params: {
          openPostId: entityId,
        },
      });
      return;
    }

    router.push({
      pathname: '/user/[id]',
      params: {
        id: ownerId,
        openPostId: entityId,
      },
    });
    return;
  }

  if (actorId) {
    router.push({ pathname: '/user/[id]', params: { id: actorId } });
  }
};
