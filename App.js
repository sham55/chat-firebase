import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";


import { useUserPresence } from "./hooks/useUserPresence";

// Screens
import Chat from "./screens/Chat";
import ChatThread from "./screens/ChatThread";
import Coin from "./screens/Coin";
import Conversations from "./screens/Conversations";
import Home from "./screens/Home";
import Login from "./screens/Login";
import SelectUser from "./screens/SelectUser";
import Signup from "./screens/Signup";
import VoiceInput from "./screens/VoiceInput";
import Wallet from "./screens/Wallet";
import ForgotPassword from "./screens/ForgotPassword";
import Profile from "./screens/Profile";
import Splashscreen from "./screens/Splashscreen"; 

// Logo
import shamLogo from "./assets/logo2.png.png";

const Stack = createNativeStackNavigator();

export default function App() {
  useUserPresence();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: { backgroundColor: "#fff" },
            headerTintColor: "#f57c00",
            headerTitleStyle: { fontWeight: "bold" },
          }}
        >
          {/* 🔐 AUTH SCREENS */}
          <Stack.Screen
            name="Login"
            component={Login}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={Signup}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPassword}
            options={{
              title: "Reset Password",
              presentation: "modal",
              animation: "slide_from_right",
            }}
          />

          {/* 🎬 SPLASH (after login) */}
          <Stack.Screen
            name="Splashscreen"
            component={Splashscreen}
            options={{ headerShown: false }}
          />

          {/* 🏠 MAIN SCREENS */}
          <Stack.Screen
            name="Home"
            component={Home}
            options={{ title: "Home", headerShown: true }}
          />
          <Stack.Screen name="Profile" component={Profile} />
          <Stack.Screen
            name="Wallet"
            component={Wallet}
            options={{
              headerTitle: "My Wallet",
              headerTitleAlign: "center",
              headerLeft: () => (
                <Image
                  source={shamLogo}
                  style={{
                    width: 35,
                    height: 35,
                    marginLeft: 10,
                    resizeMode: "contain",
                  }}
                />
              ),
            }}
          />
          <Stack.Screen
            name="Coin"
            component={Coin}
            options={{ title: "ShamCoin" }}
          />
          <Stack.Screen
            name="VoiceInput"
            component={VoiceInput}
            options={{ title: "Voice Assistant" }}
          />

          {/* 💬 CHAT SCREENS */}
          <Stack.Screen
            name="Conversations"
            component={Conversations}
            options={{ title: "Conversations" }}
          />
          <Stack.Screen
            name="SelectUser"
            component={SelectUser}
            options={{ title: "Select User" }}
          />
          <Stack.Screen
            name="Chat"
            component={Chat}
            options={{ title: "Chat" }}
          />
          <Stack.Screen
            name="ChatThread"
            component={ChatThread}
            options={{ title: "Thread" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
