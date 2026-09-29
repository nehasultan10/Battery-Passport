import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_BASE_URL } from "../config";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const auth = useAuth();
  const [url, setUrl] = useState(auth.baseUrl);

  const save = async () => {
    if (!url.trim()) return;
    await auth.setBaseUrl(url);
    Alert.alert("Saved", "API base URL updated.");
  };

  const resetDefault = () => setUrl(DEFAULT_BASE_URL);

  const doLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to view passports.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await auth.logout();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
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
        Point this at your Voltrack server — production by default, or a local/dev/ngrok URL for testing.
      </Text>
      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={resetDefault}>
        <Text style={styles.linkText}>Reset to default</Text>
      </TouchableOpacity>

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
