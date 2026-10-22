import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { listPassports } from "../api/battery";
import { ApiError } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import AppShell from "../components/AppShell";
import { RootStackParamList } from "../navigation/types";
import { formatFieldValue } from "../passportSections";
import { PassportListItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Passports">;

const PAGE_SIZE = 30;
const STATUSES = ["", "INSTALLED", "AVAILABLE", "IN_SERVICE", "RETIRED", "RECYCLED"];

export default function PassportsScreen({ navigation }: Props) {
  const auth = useAuth();
  const [items, setItems] = useState<PassportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow earlier response overwriting a newer search.
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!auth.project) return;
      const id = ++requestId.current;
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);
      try {
        const res = await withAuthRetry(auth, (token) =>
          listPassports(auth.baseUrl, auth.project!.slug, token, { q: query.trim(), status, limit: PAGE_SIZE, offset })
        );
        if (id !== requestId.current) return;
        setItems((prev) => (replace ? res.data : [...prev, ...res.data]));
        setTotal(res.total);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof ApiError ? err.message : "Could not load passports.");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [auth, query, status]
  );

  // Re-query shortly after typing stops, and whenever the status filter changes.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(0, true), 350);
    return () => clearTimeout(t);
  }, [fetchPage]);

  // Pick up records created/changed elsewhere when coming back to this page.
  useFocusEffect(
    useCallback(() => {
      if (items.length) fetchPage(0, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadMore = () => {
    if (loading || loadingMore || items.length >= total) return;
    fetchPage(items.length, false);
  };

  return (
    <AppShell title="All Passports" active="Passports">
      <View style={styles.filters}>
        <TextInput
          style={styles.search}
          placeholder="Search registration, chassis, model or serial"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUSES}
          keyExtractor={(s) => s || "all"}
          contentContainerStyle={{ gap: 8, paddingTop: 10 }}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                {s ? formatFieldValue(s) : "All"}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <Text style={styles.count}>{loading ? " " : `${total} passport${total === 1 ? "" : "s"}`}</Text>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => fetchPage(0, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id ?? item.registration_number)}
          contentContainerStyle={items.length ? styles.list : styles.center}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshing={false}
          onRefresh={() => fetchPage(0, true)}
          ListEmptyComponent={<Text style={styles.emptyText}>No passports match.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#2563eb" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("PassportDetail", { code: item.registration_number })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.reg}>{item.registration_number}</Text>
                <Text style={styles.sub}>
                  {formatFieldValue(item.model)}
                  {item.chassis_no ? `  ·  ${item.chassis_no}` : ""}
                </Text>
                <Text style={styles.packs}>
                  Packs: {[item.battery_pack_a, item.battery_pack_b, item.battery_pack_c]
                    .filter((p) => p && p !== "N/A")
                    .join(", ") || "none assigned"}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{formatFieldValue(item.status)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingTop: 14 },
  search: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0f172a",
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#fff" },
  count: { fontSize: 12, color: "#64748b", marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#64748b", fontSize: 14 },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  retry: { marginTop: 14, backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10 },
  reg: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  packs: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  badge: { backgroundColor: "#e0f2fe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#0369a1" },
});
