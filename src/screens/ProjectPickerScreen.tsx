import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { listProjects } from "../api/battery";
import { ApiError } from "../api/client";
import { useAuth, withAuthRetry } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { Project } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectPicker">;

export default function ProjectPickerScreen({ navigation }: Props) {
  const auth = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withAuthRetry(auth, (token) => listProjects(auth.baseUrl, token));
      setProjects(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (project: Project) => {
    const switching = !!auth.project;
    await auth.selectProject(project);
    // First selection: the navigator swaps to the Scanner group by itself.
    // Switching from Settings: we're already inside that group, so reset it.
    if (switching) navigation.reset({ index: 0, routes: [{ name: "Scanner" }] });
  };

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

  if (projects.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Your account has no accessible projects. Contact your admin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose a project</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => choose(item)}>
            <Text style={styles.rowText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 12 },
  center: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 24 },
  heading: { fontSize: 18, fontWeight: "700", color: "#0f172a", paddingHorizontal: 20, marginBottom: 8 },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  rowText: { fontSize: 16, color: "#1e293b", fontWeight: "500" },
  error: { color: "#dc2626", textAlign: "center", fontSize: 14 },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#2563eb", borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600" },
});
