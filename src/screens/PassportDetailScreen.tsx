import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { resolveScan } from "../api/battery";
import { ApiError, isOfflineLike } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import Accordion from "../components/Accordion";
import FieldRow from "../components/FieldRow";
import { RootStackParamList } from "../navigation/types";
import { looksLikeSerial } from "../scanCode";
import { formatFieldLabel, formatFieldValue, HEADLINE_FIELDS, PASSPORT_SECTIONS } from "../passportSections";
import { addScanHistoryEntry, cachePassport, getCachedPassport } from "../storage/scanHistory";
import { BatteryPassport } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "PassportDetail">;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; notFound: boolean }
  | { status: "ready"; passport: BatteryPassport; cachedAt: string | null };

export default function PassportDetailScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    if (!auth.project) {
      setState({ status: "error", message: "No project selected.", notFound: false });
      return;
    }
    try {
      const passport = await withAuthRetry(auth, (token) =>
        resolveScan(auth.baseUrl, auth.project!.slug, token, code)
      );
      setState({ status: "ready", passport, cachedAt: null });
      // Local bookkeeping must never turn a successful live read into an
      // error screen, so storage failures are swallowed here.
      try {
        await cachePassport(passport);
        await addScanHistoryEntry({
          passportId: passport.battery_serial_number,
          registrationNumber: passport.registration_number,
          model: (passport.model as string | null) ?? null,
          scannedAt: new Date().toISOString(),
        });
      } catch (storageErr) {
        console.warn("Could not save passport locally", storageErr);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ status: "error", message: `No battery found for this code.`, notFound: true });
        return;
      }
      // Only genuine connectivity/server failures fall back to the cached
      // copy (PRD: "cached as of [timestamp]" banner) - never auth or
      // permission errors, which a stale copy would paper over.
      let cached = null;
      if (isOfflineLike(err)) {
        try {
          cached = await getCachedPassport(code);
        } catch {
          cached = null;
        }
      }
      if (cached) {
        setState({ status: "ready", passport: cached.passport, cachedAt: cached.cachedAt });
      } else {
        setState({
          status: "error",
          message: err instanceof ApiError ? err.message : "Could not load this passport.",
          notFound: false,
        });
      }
    }
  }, [auth, code]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{state.notFound ? "Battery not found" : "Couldn't load passport"}</Text>
        <Text style={styles.errorMessage}>{state.message}</Text>
        {state.notFound && !looksLikeSerial(code) ? (
          <Text style={styles.errorMessage}>That doesn't look like a valid battery serial, so it can't be mapped.</Text>
        ) : state.notFound ? (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.replace("MapBattery", { code })}
          >
            <Text style={styles.retryText}>Map this battery</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Back to scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { passport, cachedAt } = state;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {cachedAt && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheBannerText}>
            Offline — showing cached data as of {new Date(cachedAt).toLocaleString()}
          </Text>
        </View>
      )}

      <Text style={styles.registration}>{passport.registration_number}</Text>
      <Text style={styles.model}>{formatFieldValue(passport.model)}</Text>

      <View style={styles.headlineGrid}>
        {HEADLINE_FIELDS.map((field) => (
          <View key={field} style={styles.headlineItem}>
            <Text style={styles.headlineLabel}>{formatFieldLabel(field)}</Text>
            <Text style={styles.headlineValue}>{formatFieldValue(passport[field])}</Text>
          </View>
        ))}
      </View>

      {PASSPORT_SECTIONS.map((section, index) => (
        <Accordion key={section.title} title={section.title} defaultOpen={index === 0}>
          {section.fields.map((field) => (
            <FieldRow key={field} field={field} value={passport[field]} />
          ))}
        </Accordion>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 24 },
  cacheBanner: {
    backgroundColor: "#fef3c7",
    borderColor: "#fbbf24",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  cacheBannerText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  registration: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  model: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  headlineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  headlineItem: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: "47%",
  },
  headlineLabel: { fontSize: 11, color: "#64748b", marginBottom: 2 },
  headlineValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  errorTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  errorMessage: { fontSize: 14, color: "#64748b", textAlign: "center" },
  retryButton: { marginTop: 16, backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600" },
  linkButton: { marginTop: 12 },
  linkText: { color: "#2563eb", fontSize: 14 },
});
