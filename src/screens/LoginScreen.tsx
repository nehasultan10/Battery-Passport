import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(username.trim(), password);
      // No navigation here: signing in changes the auth state, which swaps
      // the navigator over to the project picker (see RootNavigator).
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Battery Passport</Text>
        <Text style={styles.subtitle}>Sign in with your Voltrack account</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("Settings")}>
          <Text style={styles.linkText}>API settings</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 6, marginBottom: 32 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  error: { color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  linkButton: { marginTop: 20, alignItems: "center" },
  linkText: { color: "#60a5fa", fontSize: 14 },
});
