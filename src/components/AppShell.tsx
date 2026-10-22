import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";

export type ShellPage = "Home" | "Passports" | "CreateRecord";

const SIDEBAR_WIDTH = Math.min(300, Dimensions.get("window").width * 0.8);

const PAGES: { key: ShellPage; label: string; icon: string; hint: string }[] = [
  { key: "Home", label: "Home", icon: "⌂", hint: "Scan & recent" },
  { key: "Passports", label: "All Passports", icon: "☰", hint: "Browse every battery in this depot" },
  { key: "CreateRecord", label: "Create Record", icon: "＋", hint: "Add a new battery passport" },
];

/**
 * Page chrome for the top-level screens: a header with a menu button and a
 * slide-in sidebar listing the pages, project switcher and log out. Plain
 * Animated (no drawer library) so it needs no extra native modules.
 */
export default function AppShell({
  title,
  active,
  children,
}: {
  title: string;
  active: ShellPage;
  children: React.ReactNode;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    setVisible(true);
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  const close = useCallback(
    (after?: () => void) => {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setVisible(false);
        after?.();
      });
    },
    [progress]
  );

  // Android back button closes the sidebar first.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  const go = (page: ShellPage) => {
    if (page === active) {
      close();
      return;
    }
    // Top-level pages replace each other, so Back never walks through every page visited.
    close(() => navigation.reset({ index: 0, routes: [{ name: page }] }));
  };

  const confirmLogout = () =>
    Alert.alert("Log out?", "You'll need to sign in again to view passports.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => auth.logout() },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={open} accessibilityLabel="Open menu">
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.project}>{auth.project?.name ?? "No project"}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>{children}</View>

      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.backdrop, { opacity: progress }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-SIDEBAR_WIDTH, 0] }) }] },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left"]}>
              <View style={styles.brand}>
                <Text style={styles.brandTitle}>Battery Passport</Text>
                <Text style={styles.brandProject}>{auth.project?.name ?? "No project"}</Text>
              </View>

              <View style={{ flex: 1 }}>
                {PAGES.map((page) => {
                  const isActive = page.key === active;
                  return (
                    <TouchableOpacity
                      key={page.key}
                      style={[styles.item, isActive && styles.itemActive]}
                      onPress={() => go(page.key)}
                    >
                      <Text style={[styles.itemIcon, isActive && styles.itemTextActive]}>{page.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemLabel, isActive && styles.itemTextActive]}>{page.label}</Text>
                        <Text style={styles.itemHint}>{page.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => close(() => navigation.navigate("ProjectPicker"))}
                >
                  <Text style={styles.itemIcon}>⇄</Text>
                  <Text style={styles.itemLabel}>Switch project</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={() => close(confirmLogout)}>
                  <Text style={[styles.itemIcon, { color: "#f87171" }]}>⏻</Text>
                  <Text style={[styles.itemLabel, { color: "#f87171" }]}>Log out</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  menuButton: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8 },
  menuIcon: { color: "#fff", fontSize: 24 },
  title: { color: "#fff", fontSize: 19, fontWeight: "700" },
  project: { color: "#93c5fd", fontSize: 12, marginTop: 2 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#0f172a",
    elevation: 16,
  },
  brand: { paddingHorizontal: 20, paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: "#1e293b", marginBottom: 8 },
  brandTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  brandProject: { color: "#93c5fd", fontSize: 13, marginTop: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 8, borderRadius: 10 },
  itemActive: { backgroundColor: "#2563eb" },
  itemIcon: { color: "#94a3b8", fontSize: 20, width: 24, textAlign: "center" },
  itemLabel: { color: "#e2e8f0", fontSize: 15, fontWeight: "600" },
  itemHint: { color: "#64748b", fontSize: 11, marginTop: 2 },
  itemTextActive: { color: "#fff" },
  footer: { borderTopWidth: 1, borderTopColor: "#1e293b", paddingVertical: 8 },
});
