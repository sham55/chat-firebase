import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "",
  authDomain: "reutherfeld.firebaseapp.com",
  projectId: "reutherfeld",
  storageBucket: "reutherfeld.appspot.com",
  messagingSenderId: "560144149047",
  appId: "1:560144149047:web:85c0c9a673c05c30e76db2",
};

// 🔹 Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 🔹 Initialize Auth safely (avoid "already-initialized" error)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

// 🔹 Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
