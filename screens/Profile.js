// screens/Profile.js
import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { MaterialIcons } from "@expo/vector-icons";

export default function Profile() {
  const [photoURL, setPhotoURL] = useState(null);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const docRef = doc(db, "users", user.email);
        const userSnap = await getDoc(docRef);
        if (userSnap.exists()) {
          setPhotoURL(userSnap.data().photoURL || null);
        } else {
          setPhotoURL(user.photoURL || null);
        }
      } catch (err) {
        console.log("Error fetching user data:", err.message);
      }
    };
    fetchUser();
  }, []);

  /** 🔹 Pick and upload photo */
  const pickAndUploadImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Denied", "Allow access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);
        const uri = result.assets[0].uri;
        await uploadToFirebase(uri);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  /** 🔹 Upload image to Firebase Storage */
  const uploadToFirebase = async (uri) => {
    try {
      const storage = getStorage();
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profilePhotos/${filename}`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // Save in Firestore
      await setDoc(
        doc(db, "users", user.email),
        { photoURL: downloadURL },
        { merge: true }
      );

      // Update Firebase Auth profile
      await updateProfile(user, { photoURL: downloadURL });

      setPhotoURL(downloadURL);
      Alert.alert("Profile Updated", "Your photo has been updated!");
    } catch (err) {
      Alert.alert("Upload Failed", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickAndUploadImage}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="person" size={64} color="#999" />
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.email}>{user.email}</Text>
      <Text style={styles.note}>Tap the photo to update your profile picture</Text>

      {loading && <Text style={{ color: "gray", marginTop: 10 }}>Uploading...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 15,
  },
  avatarPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  email: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  note: {
    fontSize: 14,
    color: "#777",
    marginTop: 10,
  },
});
