import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () =>
  !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let app: FirebaseApp | null = null;
let _db: Database | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig);
  _db   = getDatabase(app);
  _auth = getAuth(app);
}

export const db   = _db as Database;
export const auth = _auth as Auth;
