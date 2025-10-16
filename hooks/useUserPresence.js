// hooks/useUserPresence.js
import { useEffect } from "react";
import { AppState } from "react-native";
import { auth, db } from "../config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * 🔄 useUserPresence()
 * Automatically updates user's status (online/offline) in Firestore
 * whenever the app state changes.
 */
export function useUserPresence() {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    const setStatus = async (status) => {
      try {
        await updateDoc(userRef, {
          status,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        console.log("Presence update error:", error.message);
      }
    };

    // 🟢 Mark user online when they open the app
    setStatus("online");

    // 👂 Listen for app state changes (active, background, etc.)
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") setStatus("online");
      else if (nextState.match(/inactive|background/)) setStatus("offline");
    });

    // 🧹 Cleanup: remove listener and mark offline on unmount
    return () => {
      sub.remove();
      setStatus("offline");
    };
  }, []);
}
