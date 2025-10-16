import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useNavigation } from "@react-navigation/native";

export default function SelectUser() {
  const [users, setUsers] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        // ✅ exclude logged-in user + filter valid entries
        .filter(
          (u) => u.email && auth.currentUser && u.email !== auth.currentUser.email
        );
      setUsers(list);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectUser = (user) => {
    if (!user?.email) {
      Alert.alert("Invalid User", "This user record is missing an email.");
      return;
    }
    navigation.navigate("ChatThread", { otherUser: user.email });
  };

  const renderItem = ({ item }) => {
    const displayName = item.displayName || item.email || "Unknown user";
    const letter = displayName.charAt(0).toUpperCase();
    const avatarUrl = item.photoURL || item.avatar || null;
    const isOnline = item.status === "online" || item.isOnline === true;

    // 🕒 Format “last seen” if available
    let lastSeenText = "";
    if (!isOnline && item.lastSeen?.seconds) {
      const lastSeenDate = new Date(item.lastSeen.seconds * 1000);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeenDate) / 60000);
      if (diffMinutes < 1) lastSeenText = "Last seen just now";
      else if (diffMinutes < 60) lastSeenText = `Last seen ${diffMinutes}m ago`;
      else {
        const hours = Math.floor(diffMinutes / 60);
        if (hours < 24) lastSeenText = `Last seen ${hours}h ago`;
        else lastSeenText = `Last seen on ${lastSeenDate.toLocaleDateString()}`;
      }
    }

    return (
      <TouchableOpacity style={styles.item} onPress={() => handleSelectUser(item)}>
        {/* 🖼️ Avatar or fallback */}
        <View>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{letter}</Text>
            </View>
          )}
          {/* 🟢 Online/Offline dot */}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? "#4caf50" : "#ccc" },
            ]}
          />
        </View>

        {/* 👤 User info */}
        <View style={styles.info}>
          <Text style={styles.name}>{displayName}</Text>
          {item.displayName && <Text style={styles.email}>{item.email}</Text>}
          {!isOnline && lastSeenText !== "" && (
            <Text style={styles.lastSeen}>{lastSeenText}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No users available.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatarImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 10,
  },
  avatarFallback: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#4caf50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  info: { flexDirection: "column", flex: 1 },
  name: { fontSize: 16, color: "#000", fontWeight: "500" },
  email: { fontSize: 13, color: "#777" },
  lastSeen: { fontSize: 12, color: "#999", marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 20, color: "#999" },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
    bottom: 2,
    right: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
