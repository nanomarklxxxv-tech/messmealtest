// src/lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

  const REQUIRED_FIREBASE_ENV_KEYS = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  export const getMissingFirebaseEnvVars = () => {
    return REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
      const value = import.meta.env[key];
      return typeof value !== 'string' || value.trim().length === 0;
    });
  };

  export const hasValidFirebaseConfig = () => getMissingFirebaseEnvVars().length === 0;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with persistent local cache (multi-tab safe)
let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
} catch {
    // Fallback to non-configured instance if environment does not support this API
    dbInstance = getFirestore(app);
}
export const db = dbInstance;
export const appId = 'messmeal-default';

// Initialize Messaging conditionally (not supported in all browsers)
// Keep messaging internal - don't export to avoid initialization issues
let messagingInstance = null;

(async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
    }
  } catch (err) {
    console.warn('Messaging not supported:', err);
  }
})();

// Initialize Analytics safely
let analyticsInstance = null;
(async () => {
    try {
        const supported = await isAnalyticsSupported();
        if (supported) {
            analyticsInstance = getAnalytics(app);
        }
    } catch (err) {
        console.warn('Analytics not supported:', err);
    }
})();

// Safe exports
export const getMessagingInstance = () => messagingInstance;
export const getAnalyticsInstance = () => analyticsInstance;
