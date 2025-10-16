import { Entypo, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useLayoutEffect, useState, useEffect } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../config/firebase";

export default function Home() {
  const navigation = useNavigation();
  const [avatar, setAvatar] = useState("https://i.pravatar.cc/150?img=5");
  const [unreadCount, setUnreadCount] = useState(0);

  /** 🔹 Load user avatar */
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        if (!auth.currentUser) return;
        const userRef = doc(db, "users", auth.currentUser.email);
        const snap = await getDoc(userRef);

        if (snap.exists() && snap.data().photoURL) {
          setAvatar(snap.data().photoURL);
        } else if (auth.currentUser.photoURL) {
          setAvatar(auth.currentUser.photoURL);
        }
      } catch (err) {
        console.log("Avatar load error:", err.message);
      }
    };
    loadAvatar();
  }, []);

  /** 🔹 Real-time unread counter */
  useEffect(() => {
    const currentUser = auth.currentUser?.email;
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => doc.data());
      let totalUnread = 0;

      msgs.forEach((msg) => {
        if (msg.user._id !== currentUser && !msg.readBy?.includes(currentUser)) {
          totalUnread += 1;
        }
      });

      setUnreadCount(totalUnread);
    });

    return () => unsubscribe();
  }, []);

  /** 🔹 Header setup */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <FontAwesome5
          name="search"
          size={22}
          color={colors.gray}
          style={{ marginLeft: 15 }}
        />
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <TouchableOpacity onPress={chooseUploadOption}>
            <Image
              source={{ uri: avatar }}
              style={{
                width: 40,
                height: 40,
                marginRight: 15,
                borderRadius: 20,
              }}
            />
          </TouchableOpacity>
          {/* Logout */}
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="gray" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, avatar]);

  /** 🔹 Choose upload option */
  const chooseUploadOption = () => {
    Alert.alert("Update Profile Photo", "Choose image source", [
      { text: "Camera", onPress: pickFromCamera },
      { text: "Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  /** 🔹 Pick from gallery */
  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        await uploadImage(uri);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  /** 🔹 Capture from camera */
  const pickFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Denied", "Allow camera access to take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        await uploadImage(uri);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  /** 🔹 Upload image to Firebase Storage + Firestore */
  const uploadImage = async (uri) => {
    try {
      const storage = getStorage();
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `avatars/${auth.currentUser.uid}_${Date.now()}.jpg`);

      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      setAvatar(url);

      const userRef = doc(db, "users", auth.currentUser.email);
      await setDoc(userRef, { photoURL: url }, { merge: true });

      Alert.alert("Success", "Profile photo updated!");
    } catch (err) {
      Alert.alert("Upload Error", err.message);
    }
  };

  /** 🔹 Logout */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace("Login");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  /** 🔹 Coin button */
  const handleCoinPress = () => {
    Alert.alert("ShamCoin", "Where would you like to go?", [
      {
        text: "Open Webpage",
        onPress: () => Linking.openURL("https://sham55.github.io/shamcoin/"),
      },
      {
        text: "Open Screen",
        onPress: () => navigation.navigate("Coin"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  /** 🧠 🔹 ShamBot AI button */
  const handleShamBotPress = () => {
    Alert.alert("ShamBot 🤖", "Ask me anything about ShamCoin!", [
      {
        text: "Chat with ShamBot",
        onPress: () =>
          navigation.navigate("Chat", {
            otherUser: "AIBOT", // the key that activates AI mode
          }),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {auth.currentUser?.email}</Text>

      <View style={styles.buttonContainer}>
        {/* Wallet */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Wallet")}
          style={styles.iconButton}
        >
          <FontAwesome5 name="wallet" size={28} color="#4CAF50" />
          <Text style={styles.label}>Wallet</Text>
        </TouchableOpacity>

        {/* Coin */}
        <TouchableOpacity onPress={handleCoinPress} style={styles.iconButton}>
          <FontAwesome5 name="coins" size={28} color="#FFD700" />
          <Text style={styles.label}>Coin</Text>
        </TouchableOpacity>

        {/* Voice */}
        <TouchableOpacity
          onPress={() => navigation.navigate("VoiceInput")}
          style={styles.iconButton}
        >
          <MaterialIcons name="keyboard-voice" size={28} color="#FF4081" />
          <Text style={styles.label}>Voice</Text>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Conversations")}
          style={[styles.iconButton, { position: "relative" }]}
        >
          <Entypo name="chat" size={28} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
          <Text style={styles.label}>Chat</Text>
        </TouchableOpacity>

        {/* 🧠 ShamBot Button */}
        <TouchableOpacity onPress={handleShamBotPress} style={styles.iconButton}>
          <FontAwesome5 name="robot" size={28} color="#2196F3" />
          <Text style={styles.label}>ShamBot</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  welcome: { fontSize: 18, marginBottom: 20, fontWeight: "bold" },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 20,
    flexWrap: "wrap",
  },
  iconButton: { alignItems: "center", margin: 15 },
  label: { marginTop: 5, fontSize: 14, fontWeight: "500" },
  badge: {
    position: "absolute",
    right: -5,
    top: -5,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
});
