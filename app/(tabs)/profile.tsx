import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProfileTimelineScreen } from '@/components/ProfileTimelineScreen';

export default function ProfileScreen() {
  const { openPostId } = useLocalSearchParams<{ openPostId?: string }>();
  return <ProfileTimelineScreen initialPostId={openPostId || null} />;
}
