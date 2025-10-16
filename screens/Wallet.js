import { SHAM_TOKEN_ADDRESS, ETHERSCAN_API_KEY } from "@env";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import * as Clipboard from "expo-clipboard";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import logo from "../assets/logo2.png.png";
import { auth, db } from "../config/firebase";

/** 🧩 Helpers */
const maskString = (value) => {
  if (!value || value.length < 10) return "********";
  return `${value.slice(0, 6)}************${value.slice(-4)}`;
};

const SHAM_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const encryptPrivateKey = (key, password) =>
  Buffer.from(`${key}::${password}`).toString("base64");
const decryptPrivateKey = (enc, password) => {
  const decoded = Buffer.from(enc, "base64").toString("utf8");
  const [key, pass] = decoded.split("::");
  if (pass !== password) throw new Error("Invalid password");
  return key;
};

/** 🌐 Etherscan API V2 setup */
const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";
const CHAIN_IDS = { ethereum: 1, bsc: 56 };

/** 🔍 Fetch transactions via Etherscan V2 */
const fetchTransactions = async (address, chain = "bsc") => {
  try {
    const chainId = CHAIN_IDS[chain] || 56;
    const url = `${ETHERSCAN_V2_BASE}?chainid=${chainId}&module=account&action=txlist&address=${address}&page=1&offset=30&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === "1") return data.result;
    return [];
  } catch (err) {
    console.log("Tx fetch error:", err.message);
    return [];
  }
};

export default function Wallet() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState("0");
  const [bnbBalance, setBnbBalance] = useState("0");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [importAddress, setImportAddress] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [transactions, setTransactions] = useState([]);

  /** 🔹 Header */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={logo}
            style={{ width: 36, height: 36, marginRight: 10, borderRadius: 18 }}
          />
          <Text style={{ fontSize: 20, fontWeight: "600", color: "#000" }}>
            My Wallet
          </Text>
        </View>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
          <MaterialIcons name="arrow-back" size={26} color="#007BFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  /** 🔹 Init wallet */
  useEffect(() => {
    const init = async () => {
      if (auth.currentUser) await loadWallet(auth.currentUser.uid);
    };
    init();
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") lockWallet();
    });
    return () => sub.remove();
  }, []);

  /** 🔁 Auto-refresh */
  useEffect(() => {
    if (wallet?.address) {
      fetchBalance(wallet.address);
      loadTransactions(wallet.address);
    }
  }, [wallet]);

  /** 🔹 Load transactions */
  const loadTransactions = async (addr) => {
    const txs = await fetchTransactions(addr, "bsc");
    setTransactions(txs);
  };

  /** 🧩 Load wallet */
  const loadWallet = async (uid) => {
    try {
      const ref = doc(db, `users/${uid}/wallets/default`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const myWallet = { address: data.address, readOnly: false };
        setWallet(myWallet);
        await AsyncStorage.setItem("publicAddress", data.address);
        fetchBalance(data.address);
        loadTransactions(data.address);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  /** 💰 Fetch balance */
  const fetchBalance = async (addr) => {
    try {
      const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
      const sham = new ethers.Contract(SHAM_TOKEN_ADDRESS, SHAM_ABI, provider);
      const bal = await sham.balanceOf(addr);
      const dec = await sham.decimals();
      setBalance(ethers.formatUnits(bal, dec));
      const bnb = await provider.getBalance(addr);
      setBnbBalance(ethers.formatEther(bnb));
    } catch (err) {
      console.log("Balance error:", err.message);
    }
  };

  /** 📋 Copy wallet address */
  const handleAddressPress = async () => {
    if (wallet?.address) {
      await Clipboard.setStringAsync(wallet.address);
      Alert.alert("Copied", "Wallet address copied to clipboard.");
    }
  };

  /** 🔓 Unlock / Lock */
  const unlock = async () => {
    try {
      if (!auth.currentUser) return Alert.alert("Login first.");
      const ref = doc(db, `users/${auth.currentUser.uid}/wallets/default`);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("No wallet found.");
      const dec = decryptPrivateKey(snap.data().privateKey, passwordInput);
      setRevealedKey(dec);
      setMaskedKey(maskString(dec));
      setUnlocked(true);
      setShowPrivateKey(true);
      setPasswordInput("");
      setShowKeyModal(false);
      setTimeout(() => setShowPrivateKey(false), 10000);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const lockWallet = () => {
    setUnlocked(false);
    setShowPrivateKey(false);
    setRevealedKey("");
    setMaskedKey("");
  };

  /** 💸 Send SHAM */
  const sendShamCoin = async () => {
    try {
      if (!unlocked || !revealedKey) return Alert.alert("Unlock your wallet first.");
      if (wallet.readOnly) return Alert.alert("Read-only wallet cannot send funds.");
      if (!ethers.isAddress(recipient.trim())) throw new Error("Invalid recipient.");
      if (!amount || Number(amount) <= 0) throw new Error("Invalid amount.");

      const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
      const signer = new ethers.Wallet(revealedKey, provider);
      const gas = await provider.getBalance(signer.address);
      if (gas === 0n) throw new Error("Not enough BNB for gas.");
      const sham = new ethers.Contract(SHAM_TOKEN_ADDRESS, SHAM_ABI, signer);
      const dec = await sham.decimals();
      const val = ethers.parseUnits(amount, dec);
      const tx = await sham.transfer(recipient.trim(), val);
      Alert.alert("Transaction Sent", tx.hash);
      await tx.wait();
      Alert.alert("Success", "Transaction confirmed!");
      fetchBalance(wallet.address);
      loadTransactions(wallet.address);
      setRecipient("");
      setAmount("");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

/** 🪙 Create New Wallet */
const createWallet = async () => {
  try {
    if (!auth.currentUser) return Alert.alert("Login first.");
    if (!password || password.length < 4)
      return Alert.alert("Error", "Please enter a password with at least 4 characters.");

    // 1️⃣ Create wallet with ethers.js
    const wallet = ethers.Wallet.createRandom();

    // 2️⃣ Encrypt private key locally
    const encryptedKey = encryptPrivateKey(wallet.privateKey, password);

    // 3️⃣ Save wallet data to Firestore
    const ref = doc(db, `users/${auth.currentUser.uid}/wallets/default`);
    await setDoc(ref, {
      address: wallet.address,
      privateKey: encryptedKey,
      createdAt: new Date().toISOString(),
    });

    // 4️⃣ Store public address locally
    await AsyncStorage.setItem("publicAddress", wallet.address);

    // 5️⃣ Update state
    setWallet({ address: wallet.address, readOnly: false });
    setPassword("");
    Alert.alert("Wallet Created", "Your new wallet is ready!");
  } catch (err) {
    Alert.alert("Error", err.message);
  }
};



  /** 🧱 UI */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My ShamCoin Wallet</Text>

      {wallet ? (
        <>
          <Text style={styles.label}>Your Address:</Text>
          <TouchableOpacity
            onPress={handleAddressPress}
            onLongPress={() => setShowQRModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.address}>{maskString(wallet.address)}</Text>
            <Text style={styles.hint}>Tap to copy • Long press for QR</Text>
          </TouchableOpacity>

          <QRCode value={wallet.address} size={140} />
          <Text style={styles.label}>Balance:</Text>
          <Text style={styles.balance}>{balance} SHAM</Text>
          <Text style={styles.gasBalance}>{bnbBalance} BNB (gas)</Text>

          {/* ✅ Scrollable Transaction History */}
          <Text style={styles.sectionTitle}>📜 Transaction History</Text>
          <View style={styles.txContainer}>
            <ScrollView
              style={{ width: "100%" }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {transactions.length > 0 ? (
                transactions.map((tx, i) => (
                  <View key={i} style={styles.txItem}>
                    <Text style={styles.txHash}>Hash: {tx.hash.slice(0, 16)}...</Text>
                    <Text>From: {maskString(tx.from)}</Text>
                    <Text>To: {maskString(tx.to || "Contract")}</Text>
                    <Text>Value: {ethers.formatEther(tx.value)} BNB</Text>
                    <Text>Date: {new Date(tx.timeStamp * 1000).toLocaleString()}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ textAlign: "center", color: "#999" }}>No transactions found.</Text>
              )}
            </ScrollView>
          </View>

          {/* 🔓 Unlock Button */}
          <TouchableOpacity
            style={[
              styles.importBtn,
              { backgroundColor: unlocked ? "#E53935" : "#FF9800", marginTop: 15 },
            ]}
            onPress={unlocked ? lockWallet : () => setShowKeyModal(true)}
          >
            <Text style={styles.btnText}>{unlocked ? "Lock 🔒" : "Unlock 🔓"}</Text>
          </TouchableOpacity>

          {showPrivateKey && (
            <>
              <Text style={styles.sectionTitle}>🔑 Private Key</Text>
              <Text selectable style={styles.privateKey}>
                {maskedKey}
              </Text>
            </>
          )}

          <Text style={styles.sectionTitle}>Send ShamCoin</Text>
          <TextInput
            placeholder="Recipient Address"
            value={recipient}
            onChangeText={setRecipient}
            style={styles.input}
          />
          <TextInput
            placeholder="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              unlocked ? styles.sendBtnActive : styles.sendBtnDisabled,
            ]}
            onPress={unlocked ? sendShamCoin : () => Alert.alert("Locked", "Unlock your wallet first.")}
            disabled={!unlocked}
          >
            <Text style={styles.btnText}>
              {unlocked ? "Send 💸" : "Unlock to Send"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ marginVertical: 10 }}>No wallet yet.</Text>
          <TextInput
            placeholder="Enter password for new wallet"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <TouchableOpacity style={styles.importBtn} onPress={createWallet}>
            <Text style={styles.btnText}>Create New Wallet</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 🔐 Unlock Modal */}
      <Modal visible={showKeyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Password to Unlock</Text>
            <TextInput
              placeholder="Wallet password"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity style={styles.unlockBtn} onPress={unlock}>
              <Text style={styles.btnText}>Unlock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unlockBtn, { backgroundColor: "#E53935" }]}
              onPress={() => setShowKeyModal(false)}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔳 QR Modal */}
      <Modal visible={showQRModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Wallet QR</Text>
            <QRCode value={wallet?.address || ""} size={250} />
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: "#E53935", marginTop: 20 }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/** 🎨 Styles */
const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 16, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 20, marginBottom: 10 },
  address: { fontSize: 14, color: "blue", marginTop: 5, textAlign: "center" },
  hint: { fontSize: 12, color: "#777", textAlign: "center", marginTop: 4 },
  balance: { fontSize: 18, fontWeight: "bold", marginTop: 10, color: "#4CAF50" },
  gasBalance: { fontSize: 14, marginTop: 5, color: "#FF9800" },
  txContainer: {
    width: "95%",
    maxHeight: 320,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fafafa",
    padding: 5,
  },
  txItem: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  txHash: { fontWeight: "bold", color: "#2196F3" },
  input: {
    width: "90%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  sendBtn: { marginTop: 15, padding: 12, borderRadius: 8, alignItems: "center", width: "90%" },
  sendBtnActive: { backgroundColor: "#4CAF50" },
  sendBtnDisabled: { backgroundColor: "#9E9E9E" },
  importBtn: { backgroundColor: "#2196F3", padding: 10, borderRadius: 8, margin: 5 },
  btnText: { color: "white", fontWeight: "bold" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 10, width: "85%", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  unlockBtn: { backgroundColor: "#4CAF50", padding: 10, borderRadius: 8, marginTop: 10, width: "100%", alignItems: "center" },
  privateKey: { fontSize: 13, backgroundColor: "#f0f0f0", padding: 10, borderRadius: 8, textAlign: "center", width: "90%" },
});
