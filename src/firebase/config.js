import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBUM7vkTz9IyRle-udONeimjjEp20QlG3o",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "cancercare-db3f9.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "cancercare-db3f9",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "cancercare-db3f9.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "953598585294",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:953598585294:web:f924b98b59e6e4dd5fa39f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;

