import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Enable offline persistence
try {
  enableIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.error('Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.error('Persistence not available in this browser');
      }
    });
} catch (error) {
  console.error('Error enabling persistence:', error);
}

// If we're in development mode, use local emulator
if (import.meta.env.DEV) {
  try {
    // Uncomment this line to connect to a local Firestore emulator if needed
    // connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Using local Firestore emulator.');
  } catch (error) {
    console.error('Error connecting to emulator:', error);
  }
}

export default app; 