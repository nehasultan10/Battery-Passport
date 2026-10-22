import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AppShell from "../components/AppShell";
import { RootStackParamList } from "../navigation/types";
import { looksLikeSerial } from "../scanCode";
import { getScanHistory } from "../storage/scanHistory";
import { ScanHistoryEntry } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getScanHistory().then(setEntries).catch(() => setEntries([]));
    }, [])
  );

  const search = () => {
    const code = query.trim();
    if (!looksLikeSerial(code)) {
      setError("Enter a pack serial, passport ID or registration number (at least 3 letters or digits).");
      return;
    }
    setError(null);
    Keyboard.dismiss();
    setQuery("");
    navigation.navigate("PassportDetail", { code });
  };

  return (
    <AppShell title="Home" active="Home">
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search serial, passport ID or registration"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={styles.searchButton} onPress={search}>
          <Text style={styles.searchButtonText}>Go</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>Recent scans</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.passportId}
        contentContainerStyle={entries.length ? styles.list : styles.emptyWrap}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyText}>Tap the Scan button below to scan a battery's QR label.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("PassportDetail", { code: item.passportId })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.reg}>{item.registrationNumber}</Text>
              <Text style={styles.model}>{item.model ?? "—"}</Text>
            </View>
            <Text style={styles.time}>{new Date(item.scannedAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate("Scanner")}>
        <Text style={styles.fabIcon}>▣</Text>
        <Text style={styles.fabText}>Scan</Text>
      </TouchableOpacity>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  searchButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" },
  searchButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: "#dc2626", fontSize: 12, marginHorizontal: 16, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#475569", marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 110 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingBottom: 100 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#334155" },
  emptyText: { fontSize: 13, color: "#64748b", marginTop: 6, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reg: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  model: { fontSize: 12, color: "#64748b", marginTop: 2 },
  time: { fontSize: 11, color: "#94a3b8", marginLeft: 8 },
  fab: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2563eb",
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: { color: "#fff", fontSize: 20 },
  fabText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
