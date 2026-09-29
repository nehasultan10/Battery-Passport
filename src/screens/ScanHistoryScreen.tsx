import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RootStackParamList } from "../navigation/types";
import { getScanHistory } from "../storage/scanHistory";
import { ScanHistoryEntry } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ScanHistory">;

export default function ScanHistoryScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  const load = useCallback(async () => {
    setEntries(await getScanHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (entries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No scans yet on this device.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(item) => item.passportId}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate("PassportDetail", { code: item.passportId })}
        >
          <View>
            <Text style={styles.reg}>{item.registrationNumber}</Text>
            <Text style={styles.model}>{item.model ?? "—"}</Text>
          </View>
          <Text style={styles.time}>{new Date(item.scannedAt).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 24 },
  empty: { color: "#64748b", fontSize: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  reg: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  model: { fontSize: 12, color: "#64748b", marginTop: 2 },
  time: { fontSize: 11, color: "#94a3b8" },
});
