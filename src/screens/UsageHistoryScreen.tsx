import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { listUsageHistory } from "../api/battery";
import { ApiError } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { UsageHistoryEntry } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "UsageHistory">;

export default function UsageHistoryScreen({ route }: Props) {
  const { batteryId } = route.params;
  const auth = useAuth();
  const [entries, setEntries] = useState<UsageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.project) return;
    setLoading(true);
    setError(null);
    try {
      const result = await withAuthRetry(auth, (token) =>
        listUsageHistory(auth.baseUrl, auth.project!.slug, token, batteryId)
      );
      setEntries(result.sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load usage history.");
    } finally {
      setLoading(false);
    }
  }, [auth, batteryId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No usage history recorded for this battery yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.date}>{item.date}</Text>
          <View style={styles.grid}>
            <Metric label="Distance" value={`${item.distance_km} km`} />
            <Metric label="SOH" value={item.soh_percent ? `${item.soh_percent}%` : "—"} />
            <Metric label="Charged" value={`${item.energy_charged_kwh} kWh`} />
            <Metric label="Discharged" value={`${item.energy_discharged_kwh} kWh`} />
            <Metric label="Cycles" value={item.cycle_count} />
            <Metric label="Capacity" value={item.capacity_kwh ? `${item.capacity_kwh} kWh` : "—"} />
            <Metric label="Max Temp" value={item.max_temperature ? `${item.max_temperature}°C` : "—"} />
            <Metric label="Min Temp" value={item.min_temperature ? `${item.min_temperature}°C` : "—"} />
          </View>
          {item.thermal_event_count > 0 && (
            <Text style={styles.warning}>{item.thermal_event_count} thermal event(s)</Text>
          )}
        </View>
      )}
    />
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
  },
  date: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { minWidth: "40%" },
  metricLabel: { fontSize: 11, color: "#64748b" },
  metricValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  warning: { marginTop: 8, color: "#dc2626", fontSize: 12, fontWeight: "600" },
  error: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  empty: { color: "#64748b", fontSize: 14, textAlign: "center" },
  retryButton: { marginTop: 16, backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600" },
});
