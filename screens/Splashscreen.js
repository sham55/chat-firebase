// screens/Splashscreen.js
import { useNavigation } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function Splashscreen() {
  const navigation = useNavigation();

  // 🎞️ Create player and auto-play
  const player = useVideoPlayer(require("../assets/shamcoin_splash_eevee.webm"), (player) => {
    player.play();
  });

  // ⏱️ Navigate to Home after 5 seconds (adjust to video length)
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigation.replace("Home");
    }, 5000);
    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.logoVideo}
        player={player}
        contentFit="contain" // ✅ keep aspect ratio
        fullscreenOptions={{ enabled: false }}
        pictureInPictureOptions={{ enabled: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  logoVideo: {
    width: 200,   // ✅ adjust width
    height: 200,  // ✅ adjust height
    borderRadius: 100, // optional: make circular if your coin is round
  },
});
