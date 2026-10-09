import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { testConnection } from "../api/battery";
import { normalizeBaseUrl } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_BASE_URL } from "../config";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const auth = useAuth();
  const [url, setUrl] = useState(auth.baseUrl);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized) {
      Alert.alert("Invalid URL", "Enter a full address starting with http:// or https://, e.g. https://passport.transvolt.org");
      return;
    }
    const apply = async () => {
      await auth.setBaseUrl(normalized);
      setUrl(normalized);
      setTestResult(null);
      // If this changed the server while signed in, setBaseUrl signed out and
      // the navigator is already back on Login.
      if (!auth.accessToken || normalized === auth.baseUrl) Alert.alert("Saved", "API base URL updated.");
    };
    if (auth.accessToken && normalized !== auth.baseUrl) {
      Alert.alert("Change server?", "Your sign-in belongs to the current server, so you'll be signed out.", [
        { text: "Cancel", style: "cancel" },
        { text: "Change & sign out", style: "destructive", onPress: apply },
      ]);
      return;
    }
    await apply();
  };

  const runTest = async () => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized) {
      setTestResult({ ok: false, message: "Enter a full http:// or https:// address first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTestResult(await testConnection(normalized));
    setTesting(false);
  };

  const resetDefault = () => setUrl(DEFAULT_BASE_URL);

  const doLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to view passports.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        // Signing out flips the navigator back to Login by itself.
        onPress: () => auth.logout(),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={DEFAULT_BASE_URL}
      />
      <Text style={styles.hint}>
        Point this at the Battery Passport server — production by default, or a local/dev/ngrok URL for testing.
      </Text>
      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={resetDefault}>
        <Text style={styles.linkText}>Reset to default</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={runTest} disabled={testing}>
        {testing ? <ActivityIndicator /> : <Text style={styles.linkText}>Test connection</Text>}
      </TouchableOpacity>
      {testResult && (
        <Text style={{ color: testResult.ok ? "#15803d" : "#dc2626", fontSize: 13, marginTop: 8 }}>
          {testResult.message}
        </Text>
      )}

      {auth.project && (
        <View style={styles.section}>
          <Text style={styles.label}>Current project</Text>
          <Text style={styles.value}>{auth.project.name}</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("ProjectPicker")}
          >
            <Text style={styles.linkText}>Switch project</Text>
          </TouchableOpacity>
        </View>
      )}

      {auth.accessToken && (
        <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={doLogout}>
          <Text style={styles.buttonText}>Log out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 16 },
  value: { fontSize: 16, color: "#0f172a", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: { fontSize: 12, color: "#64748b", marginTop: 6 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  linkButton: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#2563eb", fontSize: 14 },
  section: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 },
  logoutButton: { backgroundColor: "#dc2626", marginTop: 32 },
});
