import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { auth, db } from "../config/firebase";

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const navigation = useNavigation();

  /** ✏️ Header button */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => navigation.navigate("SelectUser")}
        >
          <MaterialIcons name="edit" size={28} color="black" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  /** 🔹 Listen for chat updates + fetch presence info */
  useEffect(() => {
    const currentUser = auth?.currentUser?.email;
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));

      const grouped = {};

      for (const msg of msgs) {
        const otherUser = msg.user._id === currentUser ? msg.to : msg.user._id;
        if (!otherUser) continue;

        if (!grouped[otherUser]) {
          grouped[otherUser] = { lastMsg: msg, unreadCount: 0 };
        }

        if (
          msg.createdAt &&
          grouped[otherUser].lastMsg.createdAt < msg.createdAt
        ) {
          grouped[otherUser].lastMsg = msg;
        }

        if (
          msg.user._id !== currentUser &&
          !msg.readBy?.includes(currentUser)
        ) {
          grouped[otherUser].unreadCount += 1;
        }
      }

      // 🔹 Fetch user profile + presence for each conversation
      const convos = await Promise.all(
        Object.entries(grouped).map(async ([otherUser, data]) => {
          let photoURL = null;
          let status = "offline";
          let lastSeen = null;

          try {
            const userDoc = await getDoc(doc(db, "users", otherUser));
            if (userDoc.exists()) {
              const u = userDoc.data();
              photoURL = u.photoURL || null;
              status = u.status || "offline";
              lastSeen = u.lastSeen || null;
            }
          } catch (err) {
            console.log("Error fetching user:", err.message);
          }

          return {
            otherUser,
            photoURL,
            status,
            lastSeen,
            ...data.lastMsg,
            unreadCount: data.unreadCount,
          };
        })
      );

      setConversations(convos);
    });

    return () => unsubscribe();
  }, []);

  /** 🔹 Mark messages as read */
  const markAsRead = async (otherUser) => {
    const currentUser = auth.currentUser.email;
    try {
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((d) => {
        const data = d.data();
        if (
          data.user._id === otherUser &&
          !data.readBy?.includes(currentUser)
        ) {
          batch.update(doc(db, "chats", d.id), {
            readBy: [...(data.readBy || []), currentUser],
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.log("Error marking as read:", err.message);
    }
  };

  /** 🔹 Delete conversation */
  const deleteConversation = async (otherUser) => {
    const currentUser = auth.currentUser.email;
    try {
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser)
      );
      const snapshot = await getDocs(q);

      const deletes = snapshot.docs.filter((d) => {
        const data = d.data();
        return (
          (data.user._id === currentUser && data.to === otherUser) ||
          (data.user._id === otherUser && data.to === currentUser)
        );
      });

      for (const docSnap of deletes) {
        await deleteDoc(doc(db, "chats", docSnap.id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  /** 🔹 Swipe delete button */
  const renderRightActions = (otherUser) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() =>
        Alert.alert("Delete Conversation", `Delete thread with ${otherUser}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteConversation(otherUser),
          },
        ])
      }
    >
      <MaterialIcons name="delete" size={28} color="#fff" />
      <Text style={{ color: "#fff", marginTop: 2 }}>Delete</Text>
    </TouchableOpacity>
  );

  /** 🔹 Render each conversation */
  const renderItem = ({ item }) => {
    const currentUser = auth.currentUser.email;
    const otherUser = item.user._id === currentUser ? item.to : item.user._id;
    const isUnread = item.unreadCount > 0 && item.user._id !== currentUser;
    const isOnline = item.status === "online";

    // 🕒 Format last seen text
    let lastSeenText = "";
    if (!isOnline && item.lastSeen?.seconds) {
      const lastSeenDate = new Date(item.lastSeen.seconds * 1000);
      const now = new Date();
      const diffMins = Math.floor((now - lastSeenDate) / 60000);
      if (diffMins < 1) lastSeenText = "Last seen just now";
      else if (diffMins < 60) lastSeenText = `Last seen ${diffMins}m ago`;
      else {
        const hours = Math.floor(diffMins / 60);
        if (hours < 24) lastSeenText = `Last seen ${hours}h ago`;
        else lastSeenText = `Last seen on ${lastSeenDate.toLocaleDateString()}`;
      }
    }

    return (
      <Swipeable renderRightActions={() => renderRightActions(otherUser)}>
        <TouchableOpacity
          style={[styles.item, isUnread && { backgroundColor: "#fffde7" }]}
          onPress={async () => {
            await markAsRead(otherUser);
            navigation.navigate("Chat", { otherUser });
          }}
        >
          {/* 🖼️ Avatar */}
          <View style={styles.avatarWrapper}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {otherUser?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* 🟢 Online dot */}
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? "#4caf50" : "#ccc" },
              ]}
            />
          </View>

          {/* 👤 Chat info */}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{otherUser}</Text>
            <Text
              style={[
                styles.lastMsg,
                isUnread && { fontWeight: "bold", color: "#000" },
              ]}
              numberOfLines={1}
            >
              {item.text || "Media"}
            </Text>
            {!isOnline && lastSeenText !== "" && (
              <Text style={styles.lastSeen}>{lastSeenText}</Text>
            )}
          </View>

          {/* 🔵 Unread badge */}
          {isUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}

          <Text style={styles.time}>
            {item.createdAt
              ? new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item, index) => item._id?.toString() || index.toString()}
      renderItem={renderItem}
    />
  );
}

/** 🎨 Styles */
const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#4caf50",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: { fontWeight: "bold", fontSize: 16 },
  lastMsg: { color: "gray", marginTop: 2, maxWidth: "85%" },
  lastSeen: { fontSize: 12, color: "#999", marginTop: 2 },
  time: { color: "gray", fontSize: 12, marginLeft: 5 },
  deleteButton: {
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    borderRadius: 4,
  },
  badge: {
    backgroundColor: "#2196f3",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
});
