import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  onIdTokenChanged,
} from '@firebase/auth/dist/rn/index.js';

const firebaseConfig = {
  apiKey: 'AIzaSyApCmKHymbDWMb8P0F37o8ckiPOkuUXY-U',
  authDomain: 'velora-f0fc6.firebaseapp.com',
  projectId: 'velora-f0fc6',
  storageBucket: 'velora-f0fc6.firebasestorage.app',
  messagingSenderId: '792599884229',
  appId: '1:792599884229:web:28f1dc5840216df548dbac',
  measurementId: 'G-S6WS9P7N02',
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();

export const subscribeToAuthProfile = (
  callback: (user: typeof auth.currentUser) => void
) => onIdTokenChanged(auth, callback);
