import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import { ethers } from "ethers";

export default function ImportWalletQR({ navigation }) {
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    if (ethers.isAddress(data)) {
      Alert.alert("Scanned!", `Address: ${data}`);
      navigation.navigate("Wallet", { address: data });
    } else {
      Alert.alert("Invalid QR", "Scanned code is not a valid address");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={{ flex: 1 }}
      />
      {scanned && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.btnText}>Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "blue",
    padding: 15,
    margin: 20,
    borderRadius: 8,
  },
  btnText: { color: "white", textAlign: "center" },
});
