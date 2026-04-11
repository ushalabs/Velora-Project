import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove } from '@firebase/firestore';
import { db } from '@/lib/firestore';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let handlerConfigured = false;
const TOKEN_KEY = 'velora_push_token';
const TOKEN_USER_KEY = 'velora_push_token_user';

const isExpoGo = () =>
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  null;

const loadNotifications = async () => {
  const Notifications = await import('expo-notifications');
  return Notifications;
};

const loadDevice = async () => {
  const Device = await import('expo-device');
  return Device;
};

export const configureForegroundNotifications = async () => {
  if (handlerConfigured || isExpoGo()) {
    return;
  }

  const Notifications = await loadNotifications();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  handlerConfigured = true;
};

export const clearStoredPushToken = async (userId: string, token: string) => {
  await updateDoc(doc(db, 'users', userId), {
    expoPushTokens: arrayRemove(token),
  });
};

export const unregisterPushToken = async (userId: string) => {
  if (!userId) {
    return;
  }

  const [storedToken, storedUserId] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(TOKEN_USER_KEY),
  ]);

  if (!storedToken || storedUserId !== userId) {
    return;
  }

  await clearStoredPushToken(userId, storedToken);
  await Promise.all([
    AsyncStorage.removeItem(TOKEN_KEY),
    AsyncStorage.removeItem(TOKEN_USER_KEY),
  ]);
};

export const registerPushToken = async (userId: string) => {
  if (!userId || isExpoGo()) {
    return null;
  }

  const Device = (await loadDevice()) as DeviceModule;
  if (!Device.isDevice) {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    return null;
  }

  const Notifications = (await loadNotifications()) as NotificationsModule;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = pushToken.data;

  const previousUserId = await AsyncStorage.getItem(TOKEN_USER_KEY);
  const previousToken = await AsyncStorage.getItem(TOKEN_KEY);

  if (previousUserId && previousToken && previousUserId !== userId) {
    await clearStoredPushToken(previousUserId, previousToken).catch(() => {});
  }

  await setDoc(
    doc(db, 'users', userId),
    {
      expoPushTokens: arrayUnion(token),
      lastPushTokenAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await Promise.all([
    AsyncStorage.setItem(TOKEN_KEY, token),
    AsyncStorage.setItem(TOKEN_USER_KEY, userId),
  ]);

  return token;
};
