import { useShamBot } from "../hooks/useShamBot"; // 🧠 ShamBot Hook
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Video } from "expo-video";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar, Bubble, GiftedChat } from "react-native-gifted-chat";
import { auth, db } from "../config/firebase";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [userPhoto, setUserPhoto] = useState(null);
  const [otherUserPhoto, setOtherUserPhoto] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { otherUser } = route.params;
  const { askShamBot } = useShamBot(); // 🧠 use the AI hook

  /** 🔹 Load both users’ profile photos */
  useEffect(() => {
    const fetchUserPhotos = async () => {
      try {
        const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.email));
        if (currentUserDoc.exists()) {
          setUserPhoto(currentUserDoc.data().photoURL || null);
        } else {
          setUserPhoto(auth.currentUser.photoURL || null);
        }

        const otherDoc = await getDoc(doc(db, "users", otherUser));
        if (otherDoc.exists()) {
          setOtherUserPhoto(otherDoc.data().photoURL || null);
        }
      } catch (err) {
        console.log("Error loading profile photos:", err.message);
      }
    };
    fetchUserPhotos();
  }, [otherUser]);

  /** 🔹 Header with logout */
  useLayoutEffect(() => {
    navigation.setOptions({
      title: otherUser === "AIBOT" ? "ShamBot 🤖" : otherUser,
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
          <MaterialIcons name="logout" size={24} color="gray" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, otherUser]);

  /** 🔹 Logout */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace("Login");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  /** 🔹 Load messages (only for human chats) */
  useEffect(() => {
    if (otherUser === "AIBOT") return; // Skip Firestore listener for AI bot
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.email),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            _id: docSnap.id,
            text: data.text || "",
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            user: data.user,
            to: data.to,
            image: data.image || null,
            video: data.video || null,
            readBy: data.readBy || [],
          };
        })
        .filter(
          (m) =>
            (m.user._id === auth.currentUser.email && m.to === otherUser) ||
            (m.user._id === otherUser && m.to === auth.currentUser.email)
        );

      setMessages(msgs);
      markMessagesAsRead(msgs);
    });

    return () => unsubscribe();
  }, [otherUser]);

  /** 🔹 Mark unread messages as read */
  const markMessagesAsRead = async (msgs) => {
    try {
      const unread = msgs.filter((m) => !m.readBy?.includes(auth.currentUser.email));
      for (const m of unread) {
        await updateDoc(doc(db, "chats", m._id), {
          readBy: [...(m.readBy || []), auth.currentUser.email],
        });
      }
    } catch (err) {
      console.log("Error marking read:", err.message);
    }
  };

  /** 🔹 Send text */
  const handleSend = async () => {
    if (inputMessage.trim() === "") return;

    const userMsg = {
      _id: Date.now().toString(),
      text: inputMessage,
      createdAt: new Date(),
      user: {
        _id: auth.currentUser.email,
        name: auth.currentUser.email,
        avatar: userPhoto || null,
      },
    };

    setInputMessage("");
    setMessages((prev) => [userMsg, ...prev]);

    // 🧠 If chatting with ShamBot
    if (otherUser === "AIBOT") {
      try {
        const botReply = await askShamBot(inputMessage);
        const botMsg = {
          _id: Date.now().toString() + "_bot",
          text: botReply,
          createdAt: new Date(),
          user: {
            _id: "AIBOT",
            name: "ShamBot 🤖",
            avatar: "https://cdn-icons-png.flaticon.com/512/4712/4712100.png",
          },
        };
        setMessages((prev) => [botMsg, ...prev]);
      } catch (err) {
        Alert.alert("ShamBot Error", err.message);
      }
      return;
    }

    // 🗂️ Normal human-to-human message
    await addDoc(collection(db, "chats"), {
      ...userMsg,
      createdAt: serverTimestamp(),
      to: otherUser,
      participants: [auth.currentUser.email, otherUser],
      readBy: [auth.currentUser.email],
    });
  };

  /** 🔹 Upload media */
  const uploadMedia = async (uri, fileType) => {
    const storage = getStorage();
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `${auth.currentUser.uid}_${Date.now()}`;
    const storageRef = ref(storage, `chatMedia/${filename}`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    const newMessage = {
      _id: Date.now().toString(),
      createdAt: serverTimestamp(),
      user: {
        _id: auth.currentUser.email,
        name: auth.currentUser.email,
        avatar: userPhoto || null,
      },
      to: otherUser,
      participants: [auth.currentUser.email, otherUser],
      type: fileType,
      image: fileType === "image" ? downloadURL : null,
      video: fileType === "video" ? downloadURL : null,
      readBy: [auth.currentUser.email],
    };

    await addDoc(collection(db, "chats"), newMessage);
  };

  /** 🔹 Pick from gallery */
  const handleSendMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const fileType = result.assets[0].type.includes("video")
          ? "video"
          : "image";
        await uploadMedia(uri, fileType);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to send media: " + err.message);
    }
  };

  /** 🔹 Capture from camera */
  const handleSendCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const fileType = result.assets[0].type.includes("video")
          ? "video"
          : "image";
        await uploadMedia(uri, fileType);
      }
    } catch (err) {
      Alert.alert("Error", "Camera failed: " + err.message);
    }
  };

  /** 🔹 Save media */
  const handleSaveMedia = async (uri) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please allow media access.");
        return;
      }
      const localFile = FileSystem.cacheDirectory + `chat_${Date.now()}.jpg`;
      const { uri: dl } = await FileSystem.downloadAsync(uri, localFile);
      await MediaLibrary.saveToLibraryAsync(dl);
      Alert.alert("Saved", "Media saved to your gallery!");
    } catch (err) {
      Alert.alert("Error", "Failed to save media: " + err.message);
    }
  };

  const confirmSaveMedia = (uri) => {
    Alert.alert("Save Media", "Do you want to save this media?", [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: () => handleSaveMedia(uri) },
    ]);
  };

  const renderMessageImage = (props) => {
    const { currentMessage } = props;
    if (currentMessage.image) {
      return (
        <TouchableOpacity onPress={() => confirmSaveMedia(currentMessage.image)} activeOpacity={0.8}>
          <Image
            source={{ uri: currentMessage.image }}
            style={{ width: 220, height: 220, borderRadius: 10, margin: 5 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderMessageVideo = (props) => {
    const { currentMessage } = props;
    if (currentMessage.video) {
      return (
        <TouchableOpacity onPress={() => confirmSaveMedia(currentMessage.video)} activeOpacity={0.8}>
          <Video
            source={{ uri: currentMessage.video }}
            style={{ width: 250, height: 180, backgroundColor: "#000", margin: 5 }}
            resizeMode="cover"
            useNativeControls
          />
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <GiftedChat
          messages={messages}
          user={{
            _id: auth.currentUser.email,
            name: auth.currentUser.email,
            avatar: userPhoto || undefined,
          }}
          renderUsernameOnMessage
          renderAvatar={(props) => (
            <Avatar
              {...props}
              containerStyle={{ left: { marginRight: 5 } }}
              imageStyle={{
                left: { borderRadius: 20 },
                right: { borderRadius: 20 },
              }}
            />
          )}
          renderInputToolbar={() => null}
          renderMessageImage={renderMessageImage}
          renderMessageVideo={renderMessageVideo}
          renderChatEmpty={() => (
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <Text>No messages yet. Say hi 👋</Text>
            </View>
          )}
          renderBubble={(props) => {
            const isSender = props.currentMessage.user._id === auth.currentUser.email;
            return (
              <Bubble
                {...props}
                wrapperStyle={{
                  left: { backgroundColor: "#e0f7fa", borderRadius: 12, padding: 5 },
                  right: { backgroundColor: "#a5d6a7", borderRadius: 12, padding: 5 },
                }}
                textStyle={{ left: { color: "#000" }, right: { color: "#000" } }}
                position={isSender ? "right" : "left"}
              />
            );
          }}
        />

        {/* Custom Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={handleSendMedia} style={[styles.iconButton, { backgroundColor: "#007bff" }]}>
            <MaterialIcons name="attach-file" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSendCamera} style={[styles.iconButton, { backgroundColor: "#ff9800" }]}>
            <MaterialIcons name="photo-camera" size={24} color="white" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={otherUser === "AIBOT" ? "Ask ShamBot..." : "Type a message..."}
            value={inputMessage}
            onChangeText={setInputMessage}
          />

          <TouchableOpacity onPress={handleSend} style={[styles.iconButton, { backgroundColor: "green" }]}>
            <MaterialIcons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: Platform.OS === "ios" ? 20 : 10,
    backgroundColor: "#f0f0f0",
  },
  input: {
    flex: 1,
    height: 48,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  iconButton: {
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 50,
  },
});
