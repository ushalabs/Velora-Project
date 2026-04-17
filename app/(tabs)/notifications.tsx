import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { auth, subscribeToAuthProfile } from '@/lib/firebase';
import {
  markNotificationRead,
  subscribeToNotifications,
  type AppNotification,
} from '@/lib/firestore';
import { navigateFromNotificationPayload } from '@/lib/notification-routing';

const formatRelativeTime = (timestamp: number) => {
  if (!timestamp) return 'now';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return 'now';
};

export default function NotificationsScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthProfile((user) => {
      setCurrentUserId(user?.uid || null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToNotifications(currentUserId, (nextNotifications) => {
      setNotifications(nextNotifications);
      setIsLoading(false);
    });

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || notifications.length === 0) {
      return;
    }

    const unread = notifications.filter((notification) => !notification.isRead);
    if (unread.length === 0) {
      return;
    }

    void Promise.all(
      unread.map((notification) => markNotificationRead(notification.id, currentUserId).catch(() => {}))
    );
  }, [currentUserId, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const handleOpenNotification = async (notification: AppNotification) => {
    if (currentUserId && !notification.isRead) {
      await markNotificationRead(notification.id, currentUserId).catch(() => {});
    }

    navigateFromNotificationPayload(notification, currentUserId);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="border-b border-border px-6 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-foreground">Notifications</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => void handleOpenNotification(item)}
              activeOpacity={0.85}
              className="flex-row items-center gap-4 py-3"
            >
              <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/15">
                {item.actorAvatar ? (
                  <Image source={{ uri: item.actorAvatar }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Text className="text-lg font-bold text-primary">
                    {item.actorUsername.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-semibold text-foreground">{item.title}</Text>
                  <Text className="ml-3 text-xs font-semibold text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</Text>
              </View>
              {!item.isRead ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View className="ml-[72px] h-px bg-border" />}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-10">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Bell size={34} color="#8B5CF6" />
          </View>
          <Text className="mt-6 text-2xl font-bold text-foreground">No notifications yet</Text>
          <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">
            Friend requests, likes, comments, mentions, and story updates will appear here in real time.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
