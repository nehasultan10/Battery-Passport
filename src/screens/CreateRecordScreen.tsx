import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createPassport } from "../api/battery";
import { ApiError } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import AppShell from "../components/AppShell";
import { RootStackParamList } from "../navigation/types";
import { normalizeRegistration } from "../scanCode";
import { NewPassportPayload } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "CreateRecord">;

type FieldKey = Exclude<keyof NewPassportPayload, "registration_number" | "status" | "battery_category">;

interface TextField {
  key: FieldKey;
  label: string;
  placeholder?: string;
  numeric?: boolean;
}

const SECTIONS: { title: string; fields: TextField[] }[] = [
  {
    title: "Vehicle",
    fields: [
      { key: "chassis_no", label: "Chassis number" },
      { key: "model", label: "Vehicle model", placeholder: "e.g. VECV-9M-AC" },
    ],
  },
  {
    title: "Battery packs",
    fields: [
      { key: "battery_pack_a", label: "Pack A serial" },
      { key: "battery_pack_b", label: "Pack B serial" },
      { key: "battery_pack_c", label: "Pack C serial" },
    ],
  },
  {
    title: "Battery details",
    fields: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "chemistry", label: "Chemistry", placeholder: "e.g. LFP" },
      { key: "manufacturing_date", label: "Manufacturing date", placeholder: "YYYY-MM-DD" },
      { key: "manufacturing_batch", label: "Manufacturing batch" },
      { key: "manufacturing_place", label: "Manufacturing place" },
    ],
  },
  {
    title: "Specifications",
    fields: [
      { key: "nominal_voltage_v", label: "Nominal voltage (V)", numeric: true },
      { key: "nominal_capacity_ah", label: "Nominal capacity (Ah)", numeric: true },
      { key: "nominal_energy_kwh", label: "Nominal energy (kWh)", numeric: true },
      { key: "usable_energy_kwh", label: "Usable energy (kWh)", numeric: true },
      { key: "battery_weight_kg", label: "Battery weight (kg)", numeric: true },
    ],
  },
];

const STATUSES = ["INSTALLED", "AVAILABLE", "IN_SERVICE", "RETIRED", "RECYCLED"];
const CATEGORIES = ["EV", "LMT", "INDUSTRIAL", "STATIONARY_BESS"];

const pretty = (v: string) => v.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

export default function CreateRecordScreen({ navigation }: Props) {
  const auth = useAuth();
  const [registration, setRegistration] = useState("");
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [status, setStatus] = useState("INSTALLED");
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const reg = normalizeRegistration(registration);
    if (reg.length < 6) {
      setError("Enter the full vehicle registration number, e.g. MH12AB1234.");
      return;
    }
    if (!auth.project) return;
    const payload: NewPassportPayload = { registration_number: reg, status };
    if (category) payload.battery_category = category;
    for (const [key, value] of Object.entries(values)) {
      if (value && value.trim()) (payload as unknown as Record<string, string>)[key] = value.trim();
    }
    setSubmitting(true);
    setError(null);
    try {
      await withAuthRetry(auth, (token) => createPassport(auth.baseUrl, auth.project!.slug, token, payload));
      // Land on the new passport; Back goes to All Passports so the new row is visible.
      navigation.reset({
        index: 1,
        routes: [{ name: "Passports" }, { name: "PassportDetail", params: { code: reg } }],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Create Record" active="CreateRecord">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            New passport in <Text style={styles.bold}>{auth.project?.name}</Text>. Only the registration number is
            required; everything else can be filled in later.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Vehicle registration number *</Text>
            <TextInput
              style={styles.input}
              value={registration}
              onChangeText={setRegistration}
              placeholder="e.g. MH12AB1234"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>
              {STATUSES.map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{pretty(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Battery category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(category === c ? null : c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.replace("_", " ")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.card}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.fields.map((f) => (
                <View key={f.key}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={values[f.key] ?? ""}
                    onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                    placeholder={f.placeholder}
                    placeholderTextColor="#94a3b8"
                    keyboardType={f.numeric ? "decimal-pad" : "default"}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          ))}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.submit, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create passport</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, color: "#64748b", marginBottom: 14 },
  bold: { fontWeight: "700", color: "#0f172a" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 2 },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#fff" },
  error: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 },
  submit: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
