import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

export default function ScannerScreen({ navigation }: Props) {
  const auth = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [manualId, setManualId] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const lastScanRef = useRef<{ id: string; at: number } | null>(null);

  const goToPassport = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      navigation.navigate("PassportDetail", { code: trimmed });
    },
    [navigation]
  );

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      // Debounce repeat triggers of the same code while it's still in frame.
      if (lastScanRef.current && lastScanRef.current.id === data && now - lastScanRef.current.at < 2000) {
        return;
      }
      lastScanRef.current = { id: data, at: now };
      // Manufacturer labels encode a bare pack serial (confirmed against a
      // real EVE Power label), but if a URL-style code is ever scanned
      // instead (e.g. our own printed labels growing a URL scheme later),
      // pull the trailing segment out rather than failing the lookup.
      const urlMatch = data.match(/\/([^/?]+)\/?(?:\?.*)?$/);
      goToPassport(data.includes("://") && urlMatch ? urlMatch[1] : data);
    },
    [goToPassport]
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is needed to scan battery QR labels.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => setShowManualEntry(true)}>
          <Text style={styles.linkText}>Enter passport ID manually instead</Text>
        </TouchableOpacity>
        {showManualEntry && (
          <ManualEntry value={manualId} onChange={setManualId} onSubmit={() => goToPassport(manualId)} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Text style={styles.projectLabel}>{auth.project?.name ?? ""}</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setTorchOn((v) => !v)}>
              <Text style={styles.iconButtonText}>{torchOn ? "Torch On" : "Torch"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("ScanHistory")}>
              <Text style={styles.iconButtonText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("Settings")}>
              <Text style={styles.iconButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.frameHint}>
          <View style={styles.frame} />
          <Text style={styles.hintText}>Point the camera at the battery's QR label</Text>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.manualButton} onPress={() => setShowManualEntry((v) => !v)}>
            <Text style={styles.manualButtonText}>
              {showManualEntry ? "Hide manual entry" : "Damaged label? Enter ID manually"}
            </Text>
          </TouchableOpacity>
          {showManualEntry && (
            <ManualEntry value={manualId} onChange={setManualId} onSubmit={() => goToPassport(manualId)} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.manualEntryRow}>
      <TextInput
        style={styles.manualInput}
        placeholder="Pack serial number"
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity style={styles.manualSubmit} onPress={onSubmit}>
        <Text style={styles.buttonText}>Go</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 0,
  },
  projectLabel: {
    color: "#fff",
    fontWeight: "700",
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  topBarActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  iconButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  frameHint: { alignItems: "center", justifyContent: "center" },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: 16,
  },
  hintText: { color: "#e2e8f0", marginTop: 16, fontSize: 13 },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 24 },
  manualButton: { alignItems: "center", paddingVertical: 8 },
  manualButtonText: { color: "#93c5fd", fontSize: 13 },
  manualEntryRow: { flexDirection: "row", marginTop: 8, gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualSubmit: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  permissionContainer: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  permissionText: { color: "#fff", fontSize: 15, textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  linkButton: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#60a5fa", fontSize: 13 },
});
