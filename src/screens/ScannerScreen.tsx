import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../navigation/types";
import { extractScanCode } from "../scanCode";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

export default function ScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const isFocused = useIsFocused();
  const [hint, setHint] = useState<string | null>(null);
  const lastScanRef = useRef<{ id: string; at: number } | null>(null);
  // Set once a scan has navigated away, so the camera (still mounted under
  // the pushed screen) can't push a second screen from another code in frame.
  const lockedRef = useRef(false);

  useEffect(() => {
    if (isFocused) lockedRef.current = false;
  }, [isFocused]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 2500);
    return () => clearTimeout(t);
  }, [hint]);

  const goToPassport = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || lockedRef.current) return;
      lockedRef.current = true;
      navigation.replace("PassportDetail", { code: trimmed });
    },
    [navigation]
  );

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lockedRef.current) return;
      const now = Date.now();
      // Debounce repeat triggers of the same code while it's still in frame.
      if (lastScanRef.current && lastScanRef.current.id === data && now - lastScanRef.current.at < 2000) {
        return;
      }
      lastScanRef.current = { id: data, at: now };
      // Bare pack serial (confirmed against a real EVE Power label), or the
      // id inside a URL-style label. Anything else isn't a battery label.
      const code = extractScanCode(data);
      if (!code) {
        setHint("That QR code isn't a battery label.");
        return;
      }
      goToPassport(code);
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
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        ) : (
          // Denied permanently: the system won't show the prompt again.
          <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Open Settings to Allow Camera</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Back</Text>
        </TouchableOpacity>
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
        onBarcodeScanned={isFocused ? onScanned : undefined}
      />

      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Text style={styles.iconButtonText}>✕ Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setTorchOn((v) => !v)}>
            <Text style={styles.iconButtonText}>{torchOn ? "Torch: On" : "Torch: Off"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.frameHint}>
          <View style={styles.frame} />
          <Text style={styles.hintText}>{hint ?? "Point the camera at the battery's QR label"}</Text>
        </View>

        <View style={styles.bottomBar} />
      </SafeAreaView>
      </KeyboardAvoidingView>
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
  permissionContainer: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  permissionText: { color: "#fff", fontSize: 15, textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  linkButton: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#60a5fa", fontSize: 13 },
});
