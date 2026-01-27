import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration - all values must come from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate required environment variables
const requiredEnvVars = {
  REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY,
  REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

const hasValidConfig = missingVars.length === 0;

if (!hasValidConfig) {
  const error = `Missing required environment variables: ${missingVars.join(', ')}`;
  if (process.env.NODE_ENV === 'development') {
    console.error(`⚠️ ${error}`);
    console.error('Please check your .env file');
  } else {
    console.warn(`⚠️ ${error} - Firebase features may not work correctly`);
  }
}

// Initialize Firebase only if we have valid config
// If config is invalid, Firebase will throw an error, so we catch it
let app = null;
let db = null;
let auth = null;
let storage = null;

try {
  if (hasValidConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } else {
    // Don't initialize if config is invalid
    console.warn('⚠️ Firebase not initialized - environment variables missing or invalid');
  }
} catch (error) {
  // Firebase initialization failed - log error but don't crash
  console.error('⚠️ Firebase initialization failed:', error.message);
  console.error('Please check your Firebase configuration and environment variables');
  
  // Services will be null - code using them should check before use
  // This prevents the app from crashing on import
}

// Export services (will be null if initialization failed)
// Code using these should check if they're null before calling methods
export { db, auth, storage };

// Export a helper to check if Firebase is configured
export function isFirebaseConfigured() {
  return !!(app && auth && db && storage);
}

export default app;

