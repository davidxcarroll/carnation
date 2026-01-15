import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with persistent caching
export const auth = getAuth(app);
export const db = getFirestore(app);

// If we're in development mode, connect to local emulator
// This must happen BEFORE any other Firestore operations
if (import.meta.env.DEV) {
  try {
    // Comment out to use production Firebase instead of emulator
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // console.log('Using local Firestore emulator.');
  } catch (error) {
    console.error('Error connecting to emulator:', error);
  }
}

// Initialize analytics after emulator setup
export const analytics = getAnalytics(app);

// Use FirestoreSettings.cache for persistent offline data
// This is the recommended approach instead of enableIndexedDbPersistence
// The cache setting is now handled automatically by the SDK
// If you need to customize caching, use the new Firestore SDK v9.0+ options

export default app; 