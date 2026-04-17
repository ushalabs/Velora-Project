import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProfileTimelineScreen } from '@/components/ProfileTimelineScreen';

export default function UserProfileScreen() {
  const { id, openPostId } = useLocalSearchParams<{ id: string; openPostId?: string }>();

  return (
    <ProfileTimelineScreen
      profileUserId={id || null}
      showBackButton
      initialPostId={openPostId || null}
    />
  );
}
