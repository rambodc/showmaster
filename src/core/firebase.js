import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');
export default app;
