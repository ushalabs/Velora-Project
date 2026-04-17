import { Tabs, router } from 'expo-router';
import { Bell, CirclePlay, MessageCircle, User } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToAuthProfile } from '@/lib/firebase';
import { subscribeToUnreadNotificationCount } from '@/lib/firestore';

cssInterop(Bell, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CirclePlay, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MessageCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToAuthProfile((user) => {
      void (async () => {
        const storedSessionUserId = await AsyncStorage.getItem('velora_session_uid');

        if (user?.uid && storedSessionUserId === user.uid) {
          setCurrentUserId(user.uid);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          return;
        }

        if (storedSessionUserId && !user) {
          return;
        }

        setIsAuthorized(false);
        setCurrentUserId(null);
        setIsCheckingAuth(false);
        router.replace('/auth');
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setUnreadNotificationCount(0);
      return;
    }

    const unsubscribe = subscribeToUnreadNotificationCount(
      currentUserId,
      setUnreadNotificationCount
    );
    return unsubscribe;
  }, [currentUserId]);

  if (isCheckingAuth) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: isDark ? '#171723' : '#FAF9FF',
          borderTopColor: isDark ? '#272737' : '#EDE9FE',
        },
        tabBarActiveTintColor: isDark ? '#A78BFA' : '#8B5CF6',
        tabBarInactiveTintColor: isDark ? '#71717A' : '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => (
            <MessageCircle className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="stories"
        options={{
          title: 'Stories',
          tabBarIcon: ({ focused }) => (
            <CirclePlay className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifis',
          tabBarBadge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
          tabBarIcon: ({ focused }) => (
            <Bell className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <User className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
