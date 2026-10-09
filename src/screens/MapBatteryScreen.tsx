import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { assignPack } from "../api/battery";
import { ApiError } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { normalizeRegistration } from "../scanCode";
import { AssignPackPayload } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "MapBattery">;

const SLOTS: Array<AssignPackPayload["pack_slot"]> = ["a", "b", "c"];

export default function MapBatteryScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const auth = useAuth();

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [packSlot, setPackSlot] = useState<AssignPackPayload["pack_slot"]>("a");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (force: boolean) => {
    if (!normalizeRegistration(registrationNumber)) {
      setError("Vehicle registration number is required.");
      return;
    }
    if (!auth.project) return;

    setSubmitting(true);
    setError(null);
    const payload: AssignPackPayload = {
      registration_number: normalizeRegistration(registrationNumber),
      pack_slot: packSlot,
      serial: code,
      force,
    };

    try {
      await withAuthRetry(auth, (token) => assignPack(auth.baseUrl, auth.project!.slug, token, payload));
      navigation.replace("PassportDetail", { code });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("Already recorded elsewhere", err.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Overwrite anyway", style: "destructive", onPress: () => submit(true) },
        ]);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not map this battery.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Map this battery</Text>
        <Text style={styles.subheading}>
          No vehicle has this serial on record yet. Enter the vehicle it belongs to.
        </Text>

        <Text style={styles.label}>Scanned serial</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{code}</Text>
        </View>

        <Text style={styles.label}>Vehicle Registration Number *</Text>
        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          placeholder="e.g. MH12AB1234"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={styles.label}>Pack Slot *</Text>
        <View style={styles.slotRow}>
          {SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              style={[styles.slotButton, packSlot === slot && styles.slotButtonActive]}
              onPress={() => setPackSlot(slot)}
            >
              <Text style={[styles.slotButtonText, packSlot === slot && styles.slotButtonTextActive]}>
                Pack {slot.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Depot / Project</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{auth.project?.name ?? "—"}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={() => submit(false)}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Map Battery</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subheading: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  readonlyBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyText: { fontSize: 14, color: "#334155", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  slotRow: { flexDirection: "row", gap: 8 },
  slotButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  slotButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  slotButtonText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  slotButtonTextActive: { color: "#fff" },
  error: { color: "#dc2626", fontSize: 13, marginTop: 16 },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
