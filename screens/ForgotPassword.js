import { sendPasswordResetEmail } from "firebase/auth";
import { useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { auth } from "../config/firebase";

// 🪙 Your logo
import shamCoin from "../assets/logo2.png.png";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const glowValue = useRef(new Animated.Value(0)).current;

  /** 🌀 Animation — Gold Coin Glow and Spin */
  const startAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(spinValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(glowValue, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glow = glowValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FFD700", "#FFB300"], // soft gold glow
  });

  /** 💌 Send Reset Email */
  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your registered email address.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      startAnimation();

      setTimeout(() => {
        Alert.alert(
          "✅ Reset Email Sent",
          "Check your inbox to reset your password."
        );
        navigation.replace("Login");
      }, 3500);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      {sent ? (
        // 🪙 SUCCESS ANIMATION
        <View style={styles.animationContainer}>
          <Animated.View
            style={[
              styles.coinContainer,
              {
                backgroundColor: glow,
                shadowColor: "#FFD700",
                shadowOpacity: 0.8,
                shadowRadius: 15,
              },
            ]}
          >
            <Animated.Image
              source={shamCoin}
              style={{
                width: 120,
                height: 120,
                transform: [
                  { rotateY: spin },
                  { perspective: 800 },
                  { scale: 1.05 },
                ],
              }}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.sentText}>Password Reset Link Sent!</Text>
        </View>
      ) : (
        // 🔹 RESET FORM
        <View style={styles.formContainer}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered email and we’ll send you a reset link.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity style={styles.button} onPress={handlePasswordReset}>
            <Text style={styles.buttonText}>Send Reset Link</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f57c00",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "gray",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#F6F7FB",
    height: 58,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  button: {
    backgroundColor: "#f57c00",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  backText: {
    color: "#007BFF",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "600",
  },
  animationContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  coinContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  sentText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#f57c00",
    marginTop: 20,
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
  },
});
