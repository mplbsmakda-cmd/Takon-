
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuSlbHce_M7Q2cO2JU7QGME-oOb8zU1vo",
  authDomain: "ai-studio-3c751.firebaseapp.com",
  projectId: "ai-studio-3c751",
  storageBucket: "ai-studio-3c751.firebasestorage.app",
  messagingSenderId: "711736023750",
  appId: "1:711736023750:web:c1222747831ac84be095c7",
  measurementId: "G-3GX2LDPFK7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence to handle "client is offline" errors gracefully
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported');
    }
});
